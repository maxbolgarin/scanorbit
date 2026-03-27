# Multi-Cloud Provider Architecture Plan

## Executive Summary

This document describes how to transform ScanOrbit from an AWS-only scanner into a multi-cloud platform supporting AWS, Google Cloud, Azure, Scaleway, Hetzner, and Yandex Cloud. The core insight is that **high-level entities (resources, findings, dependencies, scans) are already largely provider-agnostic** — the AWS coupling lives primarily in three places: the accounts table, the Go scanner workers, and the frontend account forms.

---

## Current State Analysis

### What is already generic
- **`resources`** table — `resourceId`, `service`, `region`, `name`, `state`, `tags`, `costEstimateMonthly`, `raw` all work for any cloud
- **`findings`** table — severity, status, lifecycle tracking are provider-agnostic
- **`resource_dependencies`** — relationship types like `uses_role`, `in_vpc`, `attached_to` are conceptually cross-cloud
- **`scans`** table — scan orchestration, statuses, diff tracking are generic
- **`jobs`** table — job queue system works for any provider
- **Analyzers** — the `Analyzer` interface (`Name() + Analyze()`) already takes generic `AnalyzeJob`, mostly queries DB resources rather than calling cloud APIs directly

### What is AWS-specific (needs changes)
1. **`aws_accounts` table** — hardcoded AWS fields (roleArn, awsAccountId 12-digit, externalId)
2. **`ScannerType` / `ResourceService` enums** — AWS service names only
3. **`FindingType` enum** — some are AWS-specific (EBS, EIP, Lambda, CloudWatch)
4. **Go `Scanner` struct** — hard-wired 11 AWS scanners
5. **Go `awsclient/` package** — AWS SDK calls
6. **API routes** — mounted at `/aws/accounts`, `/aws/scans`
7. **Frontend** — `AwsAccountForm`, `ScannerConfigModal`, IAM policy generator
8. **`PERMISSION_CATEGORIES`** — AWS IAM actions
9. **Go `Resource` model** — `AWSAccountID` field name

---

## Architecture Design

### Core Principle: Provider as a Plugin

```
┌──────────────────────────────────────────────────────────┐
│                    Generic Core Layer                      │
│  resources / findings / dependencies / scans / jobs        │
│  (provider-agnostic DB schema, API, frontend)              │
└─────────┬───────────────────────────────────┬────────────┘
          │                                   │
    ┌─────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │ AWS Plugin  │  │  GCP Plugin  │  │ Azure Plugin │ ...
    │ scanner     │  │  scanner     │  │  scanner     │
    │ credentials │  │  credentials │  │  credentials │
    │ service map │  │  service map │  │  service map │
    └─────────────┘  └──────────────┘  └──────────────┘
```

### Provider Type Enum

```typescript
export const CloudProvider = {
  AWS: 'aws',
  GCP: 'gcp',
  AZURE: 'azure',
  SCALEWAY: 'scaleway',
  HETZNER: 'hetzner',
  YANDEX: 'yandex',
} as const;
```

---

## Phase 1: Generalize the Data Model

### 1.1 Rename `aws_accounts` → `cloud_accounts`

New table schema:

```sql
CREATE TABLE cloud_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,           -- 'aws', 'gcp', 'azure', 'scaleway', 'hetzner', 'yandex'
  name VARCHAR(255) NOT NULL,
  account_identifier VARCHAR(255) NOT NULL, -- AWS: 12-digit ID, GCP: project-id, Azure: subscription-id, etc.
  status VARCHAR(50) DEFAULT 'pending',
  last_error TEXT,
  last_scan_at TIMESTAMP,
  enabled_scanners JSONB DEFAULT '[]',
  credentials JSONB NOT NULL,              -- provider-specific, encrypted at app level
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, provider, account_identifier)
);
```

**`credentials` JSONB** stores provider-specific auth, encrypted at the application level:

| Provider | Credentials Shape |
|----------|------------------|
| AWS | `{ roleArn, externalId }` |
| GCP | `{ serviceAccountKeyJson }` or `{ workloadIdentityProvider, serviceAccount }` |
| Azure | `{ tenantId, clientId, clientSecret }` or `{ tenantId, clientId, federatedToken }` |
| Scaleway | `{ accessKey, secretKey, organizationId, projectId }` |
| Hetzner | `{ apiToken }` |
| Yandex | `{ serviceAccountKeyJson, folderId }` or `{ oauthToken, folderId }` |

**Migration strategy**: Create the new table, migrate existing data from `aws_accounts` with `provider='aws'` and `credentials={ roleArn, externalId }`, then drop the old table. Add a DB migration view for backwards compatibility during rollout.

### 1.2 Update Foreign Keys

All tables referencing `aws_account_id` → rename to `cloud_account_id`:
- `scans.aws_account_id` → `scans.cloud_account_id`
- `resources.aws_account_id` → `resources.cloud_account_id`
- `certificates.aws_account_id` → `certificates.cloud_account_id`
- `findings.aws_account_id` → `findings.cloud_account_id`

### 1.3 Generalize Service Types

Instead of a flat enum, use a namespaced convention: `provider:service`

```
AWS:        ec2, ebs, rds, s3, alb, lambda, ...
GCP:        compute_instance, persistent_disk, cloud_sql, gcs_bucket, cloud_function, ...
Azure:      virtual_machine, managed_disk, sql_database, storage_account, function_app, ...
Scaleway:   instance, block_storage, rdb, object_storage, function, ...
Hetzner:    server, volume, load_balancer, floating_ip, ...
Yandex:     compute_instance, disk, managed_postgresql, object_storage, cloud_function, ...
```

The `service` column in `resources` already accepts any string — no schema change needed. The frontend and API filtering just need to be aware of per-provider service catalogs.

### 1.4 Generalize Finding Types

Keep current finding types but split into categories:

| Category | Cross-Cloud Findings | Provider-Specific |
|----------|---------------------|-------------------|
| **Orphaned** | `orphaned_volume`, `orphaned_ip`, `orphaned_snapshot`, `idle_load_balancer`, `unused_security_rule` | - |
| **SSL** | `ssl_expiry` | - |
| **Security** | `unencrypted_resource`, `public_access`, `permissive_firewall_rule`, `open_all_ports` | AWS: `permissive_security_group` |
| **Cost** | `unused_resource`, `stopped_instance`, `old_gen_instance`, `oversized_function` | AWS: `ebs_optimization` |
| **IAM** | `user_without_mfa`, `old_access_key`, `unused_access_key`, `unused_role` | - |
| **Compliance** | `data_residency_violation`, `missing_tag` | - |

Most finding types are naturally cross-cloud. A few need provider-neutral names (e.g. `permissive_security_group` → `permissive_firewall_rule`).

### 1.5 Generalize Relationship Types

Current relationships map naturally across clouds:

| Current (AWS) | Generic | GCP | Azure | Scaleway | Hetzner | Yandex |
|---------------|---------|-----|-------|----------|---------|--------|
| `uses_role` | `uses_role` | Service Account | Managed Identity | IAM Role | - | Service Account |
| `in_vpc` | `in_network` | VPC | VNet | VPC | Network | VPC |
| `uses_sg` | `uses_firewall_rule` | Firewall Rule | NSG | Security Group | Firewall | Security Group |
| `attached_to` | `attached_to` | same | same | same | same | same |
| `encrypted_by` | `encrypted_by` | Cloud KMS | Key Vault | - | - | KMS |

---

## Phase 2: API Layer Changes

### 2.1 Route Structure

Replace AWS-specific routes with generic provider routes:

```
Current:                          New:
/aws/accounts                 →   /accounts              (all providers)
/aws/accounts/:id             →   /accounts/:id
/aws/accounts/:id/scan        →   /accounts/:id/scan
/aws/scans                    →   /scans
/resources                    →   /resources             (unchanged)
/findings                     →   /findings              (unchanged)
```

Add `?provider=aws,gcp` filter to `/accounts` and `/resources` endpoints.

### 2.2 Account Service Refactoring

```typescript
// services/accountService.ts (replaces awsAccountService.ts)

// Provider-specific validation and connection testing
interface ProviderAdapter {
  validateCredentials(credentials: unknown): ValidationResult;
  testConnection(credentials: unknown): Promise<ConnectionResult>;
  getSetupInstructions(): SetupInstructions;
  getScannerTypes(): ScannerTypeInfo[];
}

const providerAdapters: Record<CloudProvider, ProviderAdapter> = {
  aws: new AwsAdapter(),
  gcp: new GcpAdapter(),
  azure: new AzureAdapter(),
  scaleway: new ScalewayAdapter(),
  hetzner: new HetznerAdapter(),
  yandex: new YandexAdapter(),
};
```

The `createAccount`, `testConnection`, `enqueueScan` functions become provider-aware by dispatching to the appropriate adapter.

### 2.3 Tier Limits

`maxAccounts` now means total accounts across all providers. No per-provider limits needed initially — a team tier org with 10 account slots can have 5 AWS + 3 GCP + 2 Azure.

---

## Phase 3: Go Worker Architecture

This is the biggest change. The Go workers need a provider plugin system.

### 3.1 Provider Scanner Interface

```go
// internal/providers/provider.go
package providers

type Provider interface {
    // Name returns the provider identifier (aws, gcp, azure, etc.)
    Name() string

    // ValidateCredentials checks if credentials JSON is valid
    ValidateCredentials(creds json.RawMessage) error

    // NewClient creates an authenticated client from credentials
    NewClient(ctx context.Context, creds json.RawMessage) (Client, error)

    // ScannerTypes returns available scanner types for this provider
    ScannerTypes() []string
}

type Client interface {
    // ListRegions returns available regions/zones
    ListRegions(ctx context.Context) ([]string, error)

    // Scan runs enabled scanners and returns discovered resources
    Scan(ctx context.Context, region string, enabledScanners []string) (*ScanResult, error)

    // ScanGlobal runs global (non-regional) scanners
    ScanGlobal(ctx context.Context, enabledScanners []string) (*ScanResult, error)

    // Close cleans up any resources
    Close() error
}

type ScanResult struct {
    Resources    []*models.Resource
    Certificates []*models.Certificate
    Errors       []string
}
```

### 3.2 Provider Implementations

```
workers/
├── internal/
│   ├── providers/
│   │   ├── provider.go          # Interface definitions
│   │   ├── registry.go          # Provider registry
│   │   ├── aws/
│   │   │   ├── provider.go      # AWS provider implementation
│   │   │   ├── client.go        # AWS client (refactored from awsclient/)
│   │   │   ├── ec2.go           # EC2 scanner (moved from awsclient/)
│   │   │   ├── rds.go
│   │   │   ├── s3.go
│   │   │   └── ...
│   │   ├── gcp/
│   │   │   ├── provider.go
│   │   │   ├── client.go
│   │   │   ├── compute.go       # Compute Engine scanner
│   │   │   ├── storage.go       # Cloud Storage scanner
│   │   │   ├── sql.go           # Cloud SQL scanner
│   │   │   └── ...
│   │   ├── azure/
│   │   │   ├── provider.go
│   │   │   ├── client.go
│   │   │   ├── vm.go            # Virtual Machines scanner
│   │   │   ├── storage.go       # Storage Account scanner
│   │   │   └── ...
│   │   ├── scaleway/
│   │   │   ├── provider.go
│   │   │   ├── client.go
│   │   │   ├── instance.go
│   │   │   └── ...
│   │   ├── hetzner/
│   │   │   ├── provider.go
│   │   │   ├── client.go
│   │   │   ├── server.go
│   │   │   └── ...
│   │   └── yandex/
│   │       ├── provider.go
│   │       ├── client.go
│   │       ├── compute.go
│   │       └── ...
│   ├── scanner/
│   │   └── scanner.go           # Now uses Provider interface instead of direct AWS
│   ├── analyzers/               # Mostly unchanged — already query DB, not cloud APIs
│   │   └── ...
│   ├── models/
│   │   └── resource.go          # AWSAccountID → CloudAccountID
│   └── store/
│       └── ...                  # Column renames
```

### 3.3 Refactored Scanner

```go
// internal/scanner/scanner.go — simplified
func (s *Scanner) ScanAccount(ctx context.Context, job *models.ScanAccountJob) error {
    // 1. Get account with credentials from DB
    account, err := s.store.Accounts.GetByID(ctx, job.AccountID)

    // 2. Get provider plugin from registry
    provider, err := providers.Get(account.Provider)

    // 3. Create authenticated client
    client, err := provider.NewClient(ctx, account.Credentials)
    defer client.Close()

    // 4. List regions
    regions, err := client.ListRegions(ctx)

    // 5. Fan-out: scan regions (same as today, but via generic Client)
    for _, region := range regions {
        result, err := client.Scan(ctx, region, job.EnabledScanners)
        // ... persist resources, extract dependencies
    }

    // 6. Global scans
    globalResult, err := client.ScanGlobal(ctx, job.EnabledScanners)
    // ... persist
}
```

### 3.4 Analyzers

Analyzers are already mostly generic — they query resources from DB and generate findings. Minimal changes needed:

- **Orphan analyzer**: Works across providers (volumes, IPs, snapshots are universal concepts)
- **SSL analyzer**: Already checks certificate expiry dates — fully generic
- **Security analyzer**: Needs provider-specific firewall rule parsing (AWS SG rules vs GCP firewall rules vs Azure NSG rules). Extract into provider-specific helpers
- **Cost analyzer**: Provider-specific pricing. Add `CostEstimator` interface per provider
- **IAM analyzer**: Most different per provider. Keep as provider-specific analyzer variants
- **Tagging analyzer**: Fully generic (all providers support tags/labels)
- **Residency analyzer**: Fully generic (compare resource region to allowed regions)

---

## Phase 4: Frontend Changes

### 4.1 Account Creation Flow

Replace single `AwsAccountForm` with a multi-step wizard:

```
Step 1: Choose Provider (AWS / GCP / Azure / Scaleway / Hetzner / Yandex)
Step 2: Provider-specific credential form
Step 3: Test connection
Step 4: Configure scanners (provider-specific scanner list)
```

Each provider needs:
- **Credential form component** (e.g. `AwsCredentialsForm`, `GcpCredentialsForm`, ...)
- **Setup instructions** (IAM role for AWS, service account for GCP, app registration for Azure, ...)
- **Scanner configuration** (provider-specific service list)

### 4.2 Dashboard Updates

- Account list shows provider icon/badge per account
- Resource table: `service` column shows provider-prefixed names or icons
- Filtering: add `provider` filter to resources and findings views
- Infrastructure map: group by provider, or show cross-provider dependencies

### 4.3 Component Mapping

```
Current Component           →   New Component
AwsAccountForm              →   AccountWizard (multi-provider)
ScannerConfigModal          →   ScannerConfigModal (reads scanner list from provider)
AccountsTable               →   AccountsTable + provider badge column
ResourcesTable              →   ResourcesTable + provider filter
```

---

## Phase 5: Per-Provider Implementation Details

### 5.1 Google Cloud (GCP)

**Authentication**: Service Account JSON key or Workload Identity Federation

**Scannable Resources**:
| Scanner | Resources | Finding Types |
|---------|-----------|--------------|
| Compute | VM instances, disks, snapshots, external IPs | orphaned_volume, orphaned_ip, orphaned_snapshot, stopped_instance, old_gen_instance |
| Network | VPCs, firewall rules, load balancers, Cloud NAT | permissive_firewall_rule, open_all_ports, idle_load_balancer |
| Storage | Cloud Storage buckets | public_access, unencrypted_resource |
| SQL | Cloud SQL instances | unencrypted_resource, public_access |
| Functions | Cloud Functions | oversized_function |
| IAM | Service accounts, keys | old_access_key, unused_access_key, unused_role |
| KMS | Cloud KMS keys | unused_kms_key |
| Monitoring | Cloud Logging | unused_log_group |
| Certificates | Certificate Manager | ssl_expiry |

**SDK**: `cloud.google.com/go` + individual service packages

**Regions**: Use `compute.Regions.List` API or hardcode known regions

### 5.2 Azure

**Authentication**: Service Principal (client_id + client_secret) or Managed Identity

**Scannable Resources**:
| Scanner | Resources | Finding Types |
|---------|-----------|--------------|
| Compute | VMs, managed disks, snapshots, public IPs | orphaned_volume, orphaned_ip, orphaned_snapshot, stopped_instance |
| Network | VNets, NSGs, load balancers, NAT gateways | permissive_firewall_rule, open_all_ports, idle_load_balancer |
| Storage | Storage accounts, blob containers | public_access, unencrypted_resource |
| SQL | Azure SQL, PostgreSQL, MySQL | unencrypted_resource, public_access |
| Functions | Function Apps | oversized_function |
| IAM | Azure AD apps, service principals, role assignments | unused_role |
| KeyVault | Key Vault keys and secrets | unused_kms_key |
| Monitor | Log Analytics workspaces | unused_log_group |
| Certificates | App Service Certificates | ssl_expiry |

**SDK**: `github.com/Azure/azure-sdk-for-go/sdk`

**Regions**: Use `subscriptions.Client.ListLocations`

### 5.3 Scaleway

**Authentication**: Access Key + Secret Key (+ Organization/Project ID)

**Scannable Resources**:
| Scanner | Resources |
|---------|-----------|
| Instance | Instances, volumes, IPs, security groups |
| RDB | Managed databases (PostgreSQL, MySQL) |
| Object Storage | S3-compatible buckets |
| Functions | Serverless Functions/Containers |
| Load Balancer | Load Balancers |
| K8s | Kapsule clusters |

**SDK**: `github.com/scaleway/scaleway-sdk-go`

**Regions**: `fr-par`, `nl-ams`, `pl-waw` (zones: `fr-par-1`, `fr-par-2`, etc.)

**Note**: Scaleway's API is simpler than hyperscalers. Fewer resource types, simpler IAM model.

### 5.4 Hetzner

**Authentication**: API Token (single bearer token)

**Scannable Resources**:
| Scanner | Resources |
|---------|-----------|
| Server | Cloud servers |
| Volume | Block storage volumes |
| Network | Networks, firewalls, floating IPs, load balancers |
| SSH | SSH keys |

**SDK**: `github.com/hetznercloud/hcloud-go/v2`

**Regions**: `fsn1`, `nbg1`, `hel1`, `ash`, `hil` (datacenters within regions)

**Note**: Hetzner has the simplest API surface — no IAM, no managed databases via API (Robot API for dedicated is separate). Good candidate for first non-AWS provider due to simplicity.

### 5.5 Yandex Cloud

**Authentication**: Service Account JSON key or OAuth token (+ Folder ID)

**Scannable Resources**:
| Scanner | Resources |
|---------|-----------|
| Compute | VM instances, disks, snapshots |
| VPC | Networks, security groups, addresses |
| Storage | Object Storage (S3-compatible) |
| MDB | Managed PostgreSQL, MySQL, MongoDB, ClickHouse, Redis |
| Functions | Cloud Functions |
| IAM | Service accounts, keys |
| KMS | KMS keys |
| Certificate Manager | SSL certificates |
| Load Balancer | ALB, NLB |

**SDK**: `github.com/yandex-cloud/go-sdk`

**Regions**: `ru-central1` (zones: a, b, d)

---

## Phase 6: Migration Plan

### Step-by-step execution order:

1. **DB migration** — Add `cloud_accounts` table, migrate data, rename FK columns
2. **Go models** — `AWSAccountID` → `CloudAccountID`, add `Provider` field
3. **Go provider interface** — Define `Provider` and `Client` interfaces
4. **Refactor AWS into provider plugin** — Move `awsclient/` → `providers/aws/`, implement interfaces
5. **Refactor scanner** — Use `Provider` interface instead of direct AWS scanners
6. **API layer** — Rename routes, add `provider` field to account CRUD, update filters
7. **Frontend** — Multi-provider account wizard, provider badges, filtering
8. **Implement Hetzner** — Simplest provider, validates the plugin architecture
9. **Implement Scaleway** — Second simple one, confirms pattern
10. **Implement GCP** — First hyperscaler, most complex after AWS
11. **Implement Azure** — Second hyperscaler
12. **Implement Yandex Cloud** — Final provider

### Migration Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking existing AWS users | Keep `aws_accounts` as a view over `cloud_accounts WHERE provider='aws'` during transition |
| Credential encryption changes | New `credentials` JSONB uses same AES-256 encryption as current `externalId` |
| Go module bloat (all provider SDKs) | Use Go build tags to compile only needed providers, or separate binaries per provider |
| Analyzer complexity explosion | Most analyzers already work on DB data — keep them generic, only add provider-specific helpers for firewall rule parsing and cost estimation |

---

## Estimated Scope per Provider

| Provider | Effort | Scanner Count | Notes |
|----------|--------|--------------|-------|
| AWS (existing) | Refactor only | 11 | Already done, just needs abstraction |
| Hetzner | Small | 4-5 | Simplest API, no IAM |
| Scaleway | Small-Medium | 6-7 | Simple API, good SDK |
| Yandex Cloud | Medium | 8-10 | Decent SDK, moderate API surface |
| GCP | Large | 9-11 | Complex IAM, many services |
| Azure | Large | 9-11 | Complex auth, many services |

---

## Open Questions

1. **Should scanner workers be separate binaries per provider?** Build tags vs separate `cmd/scanner-aws`, `cmd/scanner-gcp`, etc. Separate binaries are cleaner for deployment but more ops overhead.

2. **Cross-cloud dependencies?** E.g., an AWS Lambda connecting to a GCP Cloud SQL. For now, dependencies are within a single account. Cross-account/cross-provider dependency tracking could be a future feature.

3. **Unified region naming?** Should we normalize region names across providers (e.g. "Europe West") or keep provider-native names (`eu-west-1`, `europe-west1`, `westeurope`)? Recommendation: keep native names, add a display label mapping.

4. **Cost estimation**: Each provider has different pricing APIs/models. Start with static price tables, later integrate provider pricing APIs.
