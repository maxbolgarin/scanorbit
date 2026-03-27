# Yandex Cloud Provider — Development Guide

Yandex Cloud is a full-featured cloud provider with a broad service catalog. It has a well-structured gRPC-based API and an official Go SDK. Moderate implementation complexity — more services than Scaleway, but a single region simplifies scanning.

---

## Overview

| Aspect | Details |
|--------|---------|
| **Authentication** | Service Account Key (JSON) or OAuth token, scoped to Folder |
| **Go SDK** | `github.com/yandex-cloud/go-sdk` |
| **API** | gRPC (primary) + REST (secondary), protobuf-defined |
| **Rate Limits** | Varies by service, generally 100-1000 req/s |
| **Regions** | `ru-central1` (zones: a, b, d) |
| **Hierarchy** | Cloud → Folder → Resources |
| **IAM** | Yes — service accounts, keys, role bindings, federated auth |
| **Complexity** | Medium — broad service catalog, gRPC API, single region |

---

## Authentication

Yandex Cloud supports multiple auth methods. For ScanOrbit, **Service Account Key** is the recommended approach (analogous to GCP service account keys).

### Credential Shape

```json
{
  "serviceAccountKeyJson": "encrypted:...",
  "folderId": "b1gxxxxxxxxxx",
  "cloudId": "b1gxxxxxxxxxx"
}
```

The `serviceAccountKeyJson` is the full JSON key file content, encrypted at the application level. It contains:

```json
{
  "id": "ajexxxxxxxxxx",
  "service_account_id": "ajexxxxxxxxxx",
  "created_at": "2024-01-01T00:00:00Z",
  "key_algorithm": "RSA_2048",
  "public_key": "-----BEGIN PUBLIC KEY-----\n...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n..."
}
```

### Auth Flow

1. Parse service account key JSON
2. Create JWT signed with private key
3. Exchange JWT for IAM token via `iam.v1.IamTokenService/Create`
4. IAM token is valid for 12 hours, SDK handles refresh automatically

```go
func NewClient(ctx context.Context, credsJSON json.RawMessage, logger zerolog.Logger) (*Client, error) {
    var creds YandexCredentials
    if err := json.Unmarshal(credsJSON, &creds); err != nil {
        return nil, fmt.Errorf("parse credentials: %w", err)
    }

    // Parse service account key
    key, err := iamkey.ReadFromJSONBytes([]byte(creds.ServiceAccountKeyJSON))
    if err != nil {
        return nil, fmt.Errorf("parse service account key: %w", err)
    }

    // Create SDK instance with service account auth
    sdk, err := ycsdk.Build(ctx, ycsdk.Config{
        Credentials: ycsdk.ServiceAccountKey(key),
    })
    if err != nil {
        return nil, fmt.Errorf("build yandex sdk: %w", err)
    }

    return &Client{
        sdk:      sdk,
        folderId: creds.FolderID,
        cloudId:  creds.CloudID,
        logger:   logger,
    }, nil
}
```

### Connection Test

```go
func (c *Client) TestConnection(ctx context.Context) error {
    // List compute instances with limit=1 to verify access
    _, err := c.sdk.Compute().Instance().List(ctx, &compute.ListInstancesRequest{
        FolderId: c.folderId,
        PageSize: 1,
    })
    return err
}
```

### Required Roles

The service account needs read-only roles. Assign at folder level:

```
viewer                  — basic read access to all resources
compute.viewer          — compute instances, disks, snapshots
vpc.viewer              — networks, subnets, security groups, addresses
load-balancer.viewer    — ALB and NLB
storage.viewer          — object storage buckets
managed-postgresql.viewer  — managed databases (repeat per DB engine)
serverless.functions.viewer — cloud functions
kms.viewer              — KMS keys
certificate-manager.viewer — SSL certificates
iam.viewer              — service accounts and bindings
```

### Setup Instructions (for UI)

```
1. Go to Yandex Cloud Console → your cloud → Folder
2. Create a Service Account:
   - Navigate to IAM → Service Accounts → Create
   - Name: "scanorbit-scanner"
3. Assign roles to the service account:
   - viewer (at folder level)
   - Or individual roles: compute.viewer, vpc.viewer, etc.
4. Create an authorized key:
   - Service Account → Keys → Create authorized key
   - Download the JSON key file
5. Paste the key JSON and folder ID below
```

---

## Go SDK Usage

### Installation

```bash
go get github.com/yandex-cloud/go-sdk
```

### SDK Structure

The Yandex Cloud Go SDK is auto-generated from protobuf definitions and organized by service:

```go
import (
    ycsdk "github.com/yandex-cloud/go-sdk"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/compute/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/vpc/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/loadbalancer/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/apploadbalancer/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/storage/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/mdb/postgresql/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/mdb/mysql/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/mdb/mongodb/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/mdb/clickhouse/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/mdb/redis/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/mdb/kafka/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/serverless/functions/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/iam/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/kms/v1"
    "github.com/yandex-cloud/go-genproto/yandex/cloud/certificatemanager/v1"
)
```

### Key SDK Patterns

```go
// List with pagination
resp, err := c.sdk.Compute().Instance().List(ctx, &compute.ListInstancesRequest{
    FolderId:  c.folderId,
    PageSize:  1000,
    PageToken: "",  // empty for first page
})
// resp.Instances, resp.NextPageToken

// Iterate all pages
var allInstances []*compute.Instance
pageToken := ""
for {
    resp, err := c.sdk.Compute().Instance().List(ctx, &compute.ListInstancesRequest{
        FolderId:  c.folderId,
        PageSize:  1000,
        PageToken: pageToken,
    })
    if err != nil { return nil, err }
    allInstances = append(allInstances, resp.Instances...)
    if resp.NextPageToken == "" { break }
    pageToken = resp.NextPageToken
}
```

---

## Scannable Resources

### 1. Compute Instances

**Service type**: `compute_instance`

```go
func (c *Client) ScanInstances(ctx context.Context) ([]*models.Resource, error) {
    instances, err := c.listAllInstances(ctx)
    if err != nil { return nil, err }

    var resources []*models.Resource
    for _, inst := range instances {
        r := models.NewResource(
            inst.Id,
            "compute_instance",
            inst.ZoneId,  // e.g. "ru-central1-a"
        )
        r.Name = inst.Name
        r.State = inst.Status.String()  // "RUNNING", "STOPPED", "PROVISIONING", etc.
        r.Tags = inst.Labels            // map[string]string natively
        r.Raw = marshalProtobufJSON(inst)

        // Cost estimate from resources spec
        r.CostEstimateMonthly = estimateInstanceCost(inst)
        resources = append(resources, r)
    }
    return resources, nil
}
```

**Available fields**:
- `inst.Id` — instance ID (e.g. `fhm...`)
- `inst.Name`
- `inst.FolderId`
- `inst.ZoneId` — `ru-central1-a`, `ru-central1-b`, `ru-central1-d`
- `inst.Status` — `PROVISIONING`, `RUNNING`, `STOPPING`, `STOPPED`, `STARTING`, `RESTARTING`, `UPDATING`, `ERROR`, `CRASHED`, `DELETING`
- `inst.Resources` — `Cores`, `Memory`, `CoreFraction` (CPU burst percentage)
- `inst.PlatformId` — `standard-v1`, `standard-v2`, `standard-v3`, `gpu-standard-v1`
- `inst.BootDisk` — boot disk attachment
- `inst.SecondaryDisks` — additional disk attachments
- `inst.NetworkInterfaces` — NICs with subnet, IP, security group IDs
- `inst.Labels` — `map[string]string` (native key-value, no conversion needed)
- `inst.CreatedAt` — protobuf timestamp

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `stopped_instance` | `inst.Status == STOPPED` for >7 days |
| `old_gen_instance` | `inst.PlatformId` is `standard-v1` or `standard-v2` |
| `missing_tag` | required labels missing |

### 2. Disks

**Service type**: `disk`

```go
func (c *Client) ScanDisks(ctx context.Context) ([]*models.Resource, error) {
    disks, err := c.listAllDisks(ctx)
    // ...
    for _, d := range disks {
        r := models.NewResource(d.Id, "disk", d.ZoneId)
        r.Name = d.Name
        r.State = d.Status.String()
        r.Tags = d.Labels
        // d.InstanceIds is empty if orphaned
    }
}
```

**Available fields**:
- `d.Id`, `d.Name`
- `d.Status` — `CREATING`, `READY`, `ERROR`, `DELETING`
- `d.TypeId` — `network-hdd`, `network-ssd`, `network-ssd-nonreplicated`, `network-ssd-io-m3`
- `d.Size` — bytes
- `d.ZoneId`
- `d.InstanceIds` — instances using this disk (empty = orphaned)
- `d.Labels`

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `orphaned_volume` | `len(d.InstanceIds) == 0` and `d.Status == READY` for >7 days |

### 3. Snapshots

**Service type**: `snapshot`

```go
func (c *Client) ScanSnapshots(ctx context.Context) ([]*models.Resource, error) {
    resp, err := c.sdk.Compute().Snapshot().List(ctx, &compute.ListSnapshotsRequest{
        FolderId: c.folderId,
        PageSize: 1000,
    })
    // ...
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `orphaned_snapshot` | Snapshot >30 days old with source disk deleted |

### 4. VPC Networks & Subnets

**Service type**: `vpc_network`, `vpc_subnet`

```go
func (c *Client) ScanNetworks(ctx context.Context) ([]*models.Resource, error) {
    networks, err := c.sdk.VPC().Network().List(ctx, &vpc.ListNetworksRequest{
        FolderId: c.folderId,
    })
    // ...
}

func (c *Client) ScanSubnets(ctx context.Context) ([]*models.Resource, error) {
    subnets, err := c.sdk.VPC().Subnet().List(ctx, &vpc.ListSubnetsRequest{
        FolderId: c.folderId,
    })
    // ...
}
```

### 5. Security Groups

**Service type**: `security_group`

```go
func (c *Client) ScanSecurityGroups(ctx context.Context) ([]*models.Resource, error) {
    sgs, err := c.sdk.VPC().SecurityGroup().List(ctx, &vpc.ListSecurityGroupsRequest{
        FolderId: c.folderId,
    })
    // ...
    for _, sg := range sgs.SecurityGroups {
        r := models.NewResource(sg.Id, "security_group", "global")
        r.Name = sg.Name
        r.Tags = sg.Labels
        r.Raw = marshalProtobufJSON(sg) // includes Rules
    }
}
```

**Security group rule structure**:
- `sg.Rules` — `[]*SecurityGroupRule`
  - `Direction` — `INGRESS`, `EGRESS`
  - `Ports.FromPort`, `Ports.ToPort` — port range
  - `ProtocolName` — `TCP`, `UDP`, `ICMP`, `ANY`
  - `CidrBlocks.V4CidrBlocks` — `[]string` e.g. `["0.0.0.0/0"]`

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `permissive_firewall_rule` | Ingress rule allows `0.0.0.0/0` on sensitive ports |
| `open_all_ports` | Ingress rule with `ANY` protocol from `0.0.0.0/0` |

### 6. External Addresses

**Service type**: `address`

```go
func (c *Client) ScanAddresses(ctx context.Context) ([]*models.Resource, error) {
    resp, err := c.sdk.VPC().Address().List(ctx, &vpc.ListAddressesRequest{
        FolderId: c.folderId,
    })
    // ...
    for _, addr := range resp.Addresses {
        // addr.Used — whether address is assigned
        r := models.NewResource(addr.Id, "address", addr.ZoneId)
        r.Name = addr.GetExternalIpv4Address().GetAddress()
    }
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `orphaned_ip` | `addr.Used == false` (reserved but not assigned) |

### 7. Load Balancers (ALB + NLB)

**Service type**: `alb`, `nlb`

```go
// Application Load Balancer
func (c *Client) ScanALBs(ctx context.Context) ([]*models.Resource, error) {
    resp, err := c.sdk.ApplicationLoadBalancer().LoadBalancer().List(ctx,
        &apploadbalancer.ListLoadBalancersRequest{FolderId: c.folderId})
    // ...
}

// Network Load Balancer
func (c *Client) ScanNLBs(ctx context.Context) ([]*models.Resource, error) {
    resp, err := c.sdk.LoadBalancer().NetworkLoadBalancer().List(ctx,
        &loadbalancer.ListNetworkLoadBalancersRequest{FolderId: c.folderId})
    // ...
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `idle_load_balancer` | No target groups or all targets unhealthy |

### 8. Managed Databases (MDB)

Yandex Cloud has separate APIs per database engine. Each needs its own scanner:

**Service types**: `mdb_postgresql`, `mdb_mysql`, `mdb_mongodb`, `mdb_clickhouse`, `mdb_redis`, `mdb_kafka`

```go
func (c *Client) ScanPostgreSQLClusters(ctx context.Context) ([]*models.Resource, error) {
    resp, err := c.sdk.MDB().PostgreSQL().Cluster().List(ctx,
        &postgresql.ListClustersRequest{FolderId: c.folderId})
    // ...
    for _, cluster := range resp.Clusters {
        r := models.NewResource(cluster.Id, "mdb_postgresql", "global")
        r.Name = cluster.Name
        r.State = cluster.Status.String() // "RUNNING", "ERROR", "CREATING", etc.
        r.Tags = cluster.Labels
    }
}

// Similarly for MySQL, MongoDB, ClickHouse, Redis, Kafka
```

**Available fields** (PostgreSQL as example):
- `cluster.Id`, `cluster.Name`
- `cluster.Status` — `CREATING`, `RUNNING`, `ERROR`, `UPDATING`, `STOPPING`, `STOPPED`, `STARTING`
- `cluster.Config` — PostgreSQL version, resources (CPU, RAM, disk)
- `cluster.NetworkId` — VPC network
- `cluster.Health` — `ALIVE`, `DEGRADED`, `DEAD`, `UNKNOWN`
- `cluster.Hosts` — individual host info with zone and role
- `cluster.Labels`

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `public_access` | Host config has `assignPublicIp: true` without IP restrictions |
| `unencrypted_resource` | Disk type is `network-hdd` (no encryption at rest) |
| `missing_tag` | required labels missing |

### 9. Object Storage

**Service type**: `object_storage_bucket`

Yandex Object Storage is S3-compatible. Use the AWS S3 SDK with Yandex endpoint:

```go
func (c *Client) ScanBuckets(ctx context.Context) ([]*models.Resource, error) {
    cfg := aws.Config{
        Region: "ru-central1",
        Credentials: credentials.NewStaticCredentialsProvider(
            c.creds.AccessKeyID, c.creds.SecretAccessKey, "",
        ),
        BaseEndpoint: aws.String("https://storage.yandexcloud.net"),
    }
    s3Client := s3.NewFromConfig(cfg)

    output, err := s3Client.ListBuckets(ctx, &s3.ListBucketsInput{})
    // ...
}
```

**Note**: The service account needs a static access key (different from the authorized key). Create via:
```
yc iam access-key create --service-account-id <sa-id>
```

This means the credential shape should optionally include S3 access keys:
```json
{
  "serviceAccountKeyJson": "...",
  "folderId": "...",
  "s3AccessKeyId": "...",
  "s3SecretAccessKey": "encrypted:..."
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `public_access` | Bucket ACL or policy allows public access |

### 10. Cloud Functions (Serverless)

**Service type**: `cloud_function`

```go
func (c *Client) ScanFunctions(ctx context.Context) ([]*models.Resource, error) {
    resp, err := c.sdk.Serverless().Functions().Function().List(ctx,
        &functions.ListFunctionsRequest{FolderId: c.folderId})
    // ...
    for _, fn := range resp.Functions {
        r := models.NewResource(fn.Id, "cloud_function", "global")
        r.Name = fn.Name
        r.State = fn.Status.String()
        r.Tags = fn.Labels
    }
}
```

**Available fields**:
- `fn.Id`, `fn.Name`
- `fn.Status` — `CREATING`, `ACTIVE`, `DELETING`, `ERROR`
- `fn.Runtime` — e.g. `python311`, `nodejs18`, `golang121`
- `fn.Labels`
- Version details: `fn.EntryPoint`, `fn.Resources.Memory`, `fn.ExecutionTimeout`

### 11. IAM — Service Accounts & Keys

**Service type**: `service_account`, `access_key`

```go
func (c *Client) ScanServiceAccounts(ctx context.Context) ([]*models.Resource, error) {
    resp, err := c.sdk.IAM().ServiceAccount().List(ctx,
        &iam.ListServiceAccountsRequest{FolderId: c.folderId})
    // ...
}

func (c *Client) ScanAccessKeys(ctx context.Context) ([]*models.Resource, error) {
    // For each service account, list its keys
    resp, err := c.sdk.IAM().Key().List(ctx,
        &iam.ListKeysRequest{ServiceAccountId: saId})
    // Also list static access keys
    resp, err := c.sdk.IAM().AWSCompatibility().AccessKey().List(ctx,
        &awscompatibility.ListAccessKeysRequest{ServiceAccountId: saId})
    // ...
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `old_access_key` | Key created >90 days ago |
| `unused_access_key` | Key not used in >90 days (if usage data available) |
| `unused_role` | Service account with no role bindings |

### 12. KMS Keys

**Service type**: `kms_key`

```go
func (c *Client) ScanKMSKeys(ctx context.Context) ([]*models.Resource, error) {
    resp, err := c.sdk.KMS().SymmetricKey().List(ctx,
        &kms.ListSymmetricKeysRequest{FolderId: c.folderId})
    // ...
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `unused_kms_key` | Key status is `ACTIVE` but no recent crypto operations |

### 13. Certificate Manager

**Service type**: `certificate`

```go
func (c *Client) ScanCertificates(ctx context.Context) ([]*models.Certificate, error) {
    resp, err := c.sdk.Certificates().Certificate().List(ctx,
        &certificatemanager.ListCertificatesRequest{FolderId: c.folderId})
    // ...
    for _, cert := range resp.Certificates {
        // cert.NotAfter → expiry time
        // cert.Domains → domain names
    }
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `ssl_expiry` | Certificate expires within 30/14/7 days |

---

## Dependency Mapping

| Source | Target | Relationship |
|--------|--------|-------------|
| Compute Instance | Disk | `attached_to` (via `inst.BootDisk`, `inst.SecondaryDisks`) |
| Compute Instance | VPC Network | `in_network` (via `inst.NetworkInterfaces[].SubnetId`) |
| Compute Instance | Security Group | `uses_firewall_rule` (via `inst.NetworkInterfaces[].SecurityGroupIds`) |
| Compute Instance | Address | `uses_eip` (via external IP in NIC) |
| Compute Instance | Service Account | `uses_role` (via `inst.ServiceAccountId`) |
| ALB | Target Group | `owns` (via ALB backend groups) |
| MDB Cluster | VPC Network | `in_network` (via `cluster.NetworkId`) |
| Cloud Function | Service Account | `uses_role` (via `fn.ServiceAccountId`) |
| Disk | KMS Key | `encrypted_by` (via `d.KmsKeyId` if encrypted) |

---

## Cloud/Folder Hierarchy

Yandex Cloud has a 3-level hierarchy:

```
Organization (optional)
  └── Cloud
        └── Folder (≈ AWS Account / GCP Project)
              └── Resources
```

ScanOrbit scans at the **Folder** level. One cloud_account = one folder. Users who want to scan multiple folders create multiple accounts.

The `folderId` is the primary scope for all `List*` API calls.

---

## Regions and Zones

Currently single region with 3 availability zones:

| Region | Zones |
|--------|-------|
| `ru-central1` | `ru-central1-a`, `ru-central1-b`, `ru-central1-d` |

**Note**: Zone `ru-central1-c` was deprecated and replaced by `ru-central1-d`.

```go
func (c *Client) ListRegions(ctx context.Context) ([]string, error) {
    // Single region, but resources are distributed across zones
    return []string{"ru-central1"}, nil
}
```

Since all API calls are folder-scoped (not zone-scoped), there's **no need for per-zone scanning**. A single set of `List*` calls returns resources across all zones. Each resource reports its own `ZoneId`.

---

## Pricing

Yandex Cloud has a pricing API available through the Billing service, but it's complex. Start with static price tables:

```go
var yandexComputePrices = map[string]float64{
    // Per core-hour (standard-v3 platform)
    "standard-v3-core":   0.0096, // USD
    "standard-v3-memory": 0.0025, // per GB-hour
    // Per disk
    "network-hdd-gb":     0.0016, // per GB-month
    "network-ssd-gb":     0.0063, // per GB-month
}
```

All prices are in RUB on the Yandex pricing page but can be billed in USD for international customers.

---

## Scanner Types for UI

```go
var YandexScannerTypes = []ScannerTypeInfo{
    {ID: "compute",        Label: "Compute",          Description: "VM instances, disks, snapshots"},
    {ID: "vpc",            Label: "VPC & Security",   Description: "Networks, subnets, security groups, addresses"},
    {ID: "load_balancer",  Label: "Load Balancers",   Description: "Application and network load balancers"},
    {ID: "mdb",            Label: "Managed Databases", Description: "PostgreSQL, MySQL, MongoDB, ClickHouse, Redis, Kafka"},
    {ID: "object_storage", Label: "Object Storage",   Description: "S3-compatible object storage"},
    {ID: "serverless",     Label: "Serverless",        Description: "Cloud Functions"},
    {ID: "iam",            Label: "IAM",               Description: "Service accounts and access keys"},
    {ID: "kms",            Label: "KMS & Certs",       Description: "Encryption keys and SSL certificates"},
}
```

---

## Analyzer Compatibility

| Analyzer | Compatible | Notes |
|----------|-----------|-------|
| Orphans | Yes | Disks, snapshots, addresses |
| SSL | Yes | Certificate Manager has expiry dates |
| Security | Yes | Security group rules, public DB access, encryption checks |
| Cost | Yes | Stopped instances, orphaned resources |
| Tagging | Yes | Native `map[string]string` labels (no conversion needed) |
| Residency | Partial | Single region, but can check zone placement |
| IAM | Yes | Service accounts, key age, role bindings |

---

## Implementation Checklist

- [ ] `workers/internal/providers/yandex/provider.go` — implements `Provider` interface
- [ ] `workers/internal/providers/yandex/client.go` — SDK wrapper with auth
- [ ] `workers/internal/providers/yandex/compute.go` — instances, disks, snapshots
- [ ] `workers/internal/providers/yandex/vpc.go` — networks, subnets, security groups, addresses
- [ ] `workers/internal/providers/yandex/lb.go` — ALB and NLB
- [ ] `workers/internal/providers/yandex/mdb.go` — all managed database engines
- [ ] `workers/internal/providers/yandex/object_storage.go` — S3-compatible buckets
- [ ] `workers/internal/providers/yandex/serverless.go` — Cloud Functions
- [ ] `workers/internal/providers/yandex/iam.go` — service accounts, keys, bindings
- [ ] `workers/internal/providers/yandex/kms.go` — KMS keys
- [ ] `workers/internal/providers/yandex/certificate.go` — Certificate Manager
- [ ] `workers/internal/providers/yandex/dependencies.go` — dependency extractor
- [ ] `apps/api/src/routes/` — Yandex credential validation
- [ ] `apps/app/src/components/` — Yandex credential form (key JSON upload + folder ID)
- [ ] `apps/app/src/components/` — Yandex setup instructions
- [ ] Static pricing tables (RUB/USD)
- [ ] Tests for each scanner
- [ ] Protobuf JSON marshaling utility

---

## Key Differences from AWS

| Aspect | AWS | Yandex Cloud |
|--------|-----|-------------|
| Auth | STS role assumption | Service account key → IAM token |
| SDK protocol | REST/JSON | gRPC/protobuf |
| Labels | Tags (`map[string]string`) | Labels (`map[string]string`) — identical |
| Regions | 20+ regions | 1 region, 3 zones |
| Scope | Account-wide | Folder-scoped (≈ project) |
| Databases | RDS (single API) | Separate API per engine (6 engines) |
| Object Storage | Native S3 | S3-compatible (different endpoint) |
| IAM | Users, roles, policies, groups | Service accounts, role bindings |
| Raw response | JSON | Protobuf (needs marshaling to JSON for storage) |

---

## Protobuf JSON Marshaling

Since Yandex SDK returns protobuf messages, marshal to JSON for the `raw` field:

```go
import "google.golang.org/protobuf/encoding/protojson"

func marshalProtobufJSON(msg proto.Message) json.RawMessage {
    opts := protojson.MarshalOptions{
        UseProtoNames:   true,
        EmitUnpopulated: false,
    }
    data, err := opts.Marshal(msg)
    if err != nil {
        return json.RawMessage("{}")
    }
    return json.RawMessage(data)
}
```

---

## Estimated Effort

**Medium** — 8-12 days for an experienced developer.

- ~12 scannable resource types (but single-region = simpler scanning)
- Service account key auth (JWT exchange, SDK handles refresh)
- 6 separate MDB APIs (one per database engine)
- gRPC/protobuf SDK (different pattern from REST SDKs)
- Need protobuf→JSON marshaling for `raw` field
- S3-compatible storage needs separate access keys
- IAM model is simpler than AWS but still has service accounts + role bindings
