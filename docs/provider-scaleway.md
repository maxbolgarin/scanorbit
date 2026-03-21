# Scaleway Provider — Development Guide

Scaleway is a European cloud provider with a moderate API surface — more complex than Hetzner but simpler than hyperscalers. It's a good second provider to implement.

---

## Overview

| Aspect | Details |
|--------|---------|
| **Authentication** | Access Key + Secret Key, scoped to Organization/Project |
| **Go SDK** | `github.com/scaleway/scaleway-sdk-go` |
| **API** | REST, JSON, per-product APIs at `api.scaleway.com` |
| **Rate Limits** | Varies by product, generally generous (~100 req/s) |
| **Regions** | `fr-par`, `nl-ams`, `pl-waw` (each with 1-3 zones) |
| **IAM** | Yes — users, applications, API keys, policies |
| **Complexity** | Medium — ~8 scannable resource types, multi-zone API |

---

## Authentication

Scaleway uses **Access Key + Secret Key** pairs tied to an IAM user or application. Each key pair can be scoped to a specific project.

### Credential Shape

```json
{
  "accessKey": "SCW...",
  "secretKey": "encrypted:...",
  "defaultProjectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "defaultOrganizationId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Connection Test

```go
func (c *ScalewayClient) TestConnection(ctx context.Context) error {
    // List instances with limit=1 to verify credentials
    resp, err := c.instanceAPI.ListServers(&instance.ListServersRequest{
        Zone: scw.ZoneFrPar1,
    }, scw.WithContext(ctx))
    return err
}
```

### Setup Instructions (for UI)

```
1. Go to Scaleway Console → IAM → API Keys
2. Click "Generate API Key"
3. Choose your project scope
4. Set permissions: Read-only access to the resources you want to scan
5. Copy the Access Key and Secret Key below

Recommended IAM policy permissions:
- InstancesReadOnly
- ObjectStorageReadOnly
- RDBReadOnly (if scanning databases)
- LoadBalancerReadOnly (if scanning load balancers)
- FunctionsReadOnly (if scanning serverless)
- K8sReadOnly (if scanning Kubernetes)
```

---

## Go SDK Usage

### Installation

```bash
go get github.com/scaleway/scaleway-sdk-go@latest
```

The Scaleway SDK is split into per-product packages:

```go
import (
    "github.com/scaleway/scaleway-sdk-go/scw"
    "github.com/scaleway/scaleway-sdk-go/api/instance/v1"
    "github.com/scaleway/scaleway-sdk-go/api/lb/v1"
    "github.com/scaleway/scaleway-sdk-go/api/rdb/v1"
    "github.com/scaleway/scaleway-sdk-go/api/function/v1beta1"
    "github.com/scaleway/scaleway-sdk-go/api/k8s/v1"
    "github.com/scaleway/scaleway-sdk-go/api/vpc/v2"
    "github.com/scaleway/scaleway-sdk-go/api/vpcgw/v1"
    "github.com/scaleway/scaleway-sdk-go/api/iam/v1alpha1"
)
```

### Client Setup

```go
package scaleway

import (
    "context"
    "encoding/json"
    "fmt"

    "github.com/scaleway/scaleway-sdk-go/scw"
    instanceAPI "github.com/scaleway/scaleway-sdk-go/api/instance/v1"
    lbAPI "github.com/scaleway/scaleway-sdk-go/api/lb/v1"
    rdbAPI "github.com/scaleway/scaleway-sdk-go/api/rdb/v1"
)

type ScalewayCredentials struct {
    AccessKey             string `json:"accessKey"`
    SecretKey             string `json:"secretKey"`
    DefaultProjectID      string `json:"defaultProjectId"`
    DefaultOrganizationID string `json:"defaultOrganizationId"`
}

type Client struct {
    scwClient   *scw.Client
    instanceAPI *instanceAPI.API
    lbAPI       *lbAPI.ZonedAPI
    rdbAPI      *rdbAPI.API
    // ... other product APIs
    logger      zerolog.Logger
}

func NewClient(ctx context.Context, credsJSON json.RawMessage, logger zerolog.Logger) (*Client, error) {
    var creds ScalewayCredentials
    if err := json.Unmarshal(credsJSON, &creds); err != nil {
        return nil, fmt.Errorf("parse credentials: %w", err)
    }

    scwClient, err := scw.NewClient(
        scw.WithAuth(creds.AccessKey, creds.SecretKey),
        scw.WithDefaultProjectID(creds.DefaultProjectID),
        scw.WithDefaultOrganizationID(creds.DefaultOrganizationID),
    )
    if err != nil {
        return nil, fmt.Errorf("create scaleway client: %w", err)
    }

    return &Client{
        scwClient:   scwClient,
        instanceAPI: instanceAPI.NewAPI(scwClient),
        lbAPI:       lbAPI.NewZonedAPI(scwClient),
        rdbAPI:      rdbAPI.NewAPI(scwClient),
        logger:      logger,
    }, nil
}
```

### Key SDK Patterns

```go
// List with pagination
resp, err := c.instanceAPI.ListServers(&instance.ListServersRequest{
    Zone:    scw.ZoneFrPar1,
    Page:    scw.Int32Ptr(1),
    PerPage: scw.Uint32Ptr(100),
})
// resp.Servers, resp.TotalCount

// Iterate all pages
for page := int32(1); ; page++ {
    resp, err := c.instanceAPI.ListServers(&instance.ListServersRequest{
        Zone:    zone,
        Page:    scw.Int32Ptr(page),
        PerPage: scw.Uint32Ptr(100),
    })
    if err != nil { return err }
    servers = append(servers, resp.Servers...)
    if len(servers) >= int(resp.TotalCount) { break }
}
```

---

## Scannable Resources

### 1. Instances (Servers)

**Service type**: `instance`

```go
func (c *Client) ScanInstances(ctx context.Context, zone scw.Zone) ([]*models.Resource, error) {
    var allServers []*instance.Server
    // paginate through all servers in zone...

    var resources []*models.Resource
    for _, s := range allServers {
        r := models.NewResource(
            s.ID,           // UUID string
            "instance",
            string(zone),   // e.g. "fr-par-1"
        )
        r.Name = s.Name
        r.State = string(s.State) // "running", "stopped", "stopped in place", etc.
        r.Tags = tagsToMap(s.Tags) // Scaleway tags are []string, not map
        r.Raw = marshalJSON(s)
        resources = append(resources, r)
    }
    return resources, nil
}
```

**Available fields**:
- `s.ID` — UUID
- `s.Name`
- `s.State` — `running`, `stopped`, `stopped in place`, `starting`, `stopping`, `locked`
- `s.CommercialType` — e.g. `DEV1-S`, `GP1-S`, `PRO2-S`
- `s.PublicIP`, `s.PublicIPs` — public IP addresses
- `s.PrivateIP` — private IP
- `s.PrivateNics` — private network interfaces
- `s.Volumes` — attached volumes (map[string]*Volume)
- `s.SecurityGroup` — attached security group
- `s.Tags` — `[]string` (note: not key-value, just string tags)
- `s.Image` — OS image info
- `s.Arch` — `x86_64` or `arm64`
- `s.CreationDate`

**Important**: Scaleway tags are `[]string`, not `map[string]string`. Convert to key-value pairs by splitting on `=`:

```go
func tagsToMap(tags []string) map[string]string {
    m := make(map[string]string)
    for _, tag := range tags {
        if parts := strings.SplitN(tag, "=", 2); len(parts) == 2 {
            m[parts[0]] = parts[1]
        } else {
            m[tag] = ""
        }
    }
    return m
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `stopped_instance` | `s.State == "stopped"` for >7 days |
| `missing_tag` | required tags missing |

### 2. Volumes (Block Storage)

**Service type**: `volume`

```go
func (c *Client) ScanVolumes(ctx context.Context, zone scw.Zone) ([]*models.Resource, error) {
    // List via instance API — volumes are part of the Instance API
    resp, err := c.instanceAPI.ListVolumes(&instance.ListVolumesRequest{Zone: zone})
    // ...
    for _, v := range resp.Volumes {
        r := models.NewResource(v.ID, "volume", string(zone))
        r.Name = v.Name
        r.State = string(v.State) // "available", "in_use", "error"
        r.Tags = tagsToMap(v.Tags)
        // v.Server is nil if orphaned
    }
}
```

**Available fields**:
- `v.ID`, `v.Name`, `v.Size` (bytes)
- `v.State` — `available`, `in_use`, `error`, `snapshotting`
- `v.VolumeType` — `l_ssd`, `b_ssd`, `unified`
- `v.Server` — server this volume is attached to (nil if orphaned)
- `v.Tags`
- `v.CreationDate`

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `orphaned_volume` | `v.Server == nil` and `v.State == "available"` for >7 days |

### 3. Security Groups

**Service type**: `security_group`

```go
func (c *Client) ScanSecurityGroups(ctx context.Context, zone scw.Zone) ([]*models.Resource, error) {
    resp, err := c.instanceAPI.ListSecurityGroups(&instance.ListSecurityGroupsRequest{Zone: zone})
    // ...
    for _, sg := range resp.SecurityGroups {
        r := models.NewResource(sg.ID, "security_group", string(zone))
        r.Name = sg.Name
        r.Raw = marshalJSON(sg) // includes rules

        // Fetch rules separately
        rulesResp, err := c.instanceAPI.ListSecurityGroupRules(...)
    }
}
```

**Available fields**:
- `sg.InboundDefaultPolicy` — `accept` or `drop`
- `sg.OutboundDefaultPolicy` — `accept` or `drop`
- `sg.Servers` — servers using this group
- Rules: `Direction`, `Protocol`, `PortRange`, `IPRange`, `Action` (accept/drop)

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `permissive_firewall_rule` | Inbound rule allows `0.0.0.0/0` on sensitive ports |
| `open_all_ports` | Default inbound policy is `accept` with no restrictive rules |
| `unused_security_group` | `len(sg.Servers) == 0` and not the default SG |

### 4. Flexible/Reserved IPs

**Service type**: `flexible_ip`

```go
func (c *Client) ScanIPs(ctx context.Context, zone scw.Zone) ([]*models.Resource, error) {
    resp, err := c.instanceAPI.ListIPs(&instance.ListIPsRequest{Zone: zone})
    // ...
    for _, ip := range resp.IPs {
        r := models.NewResource(ip.ID, "flexible_ip", string(zone))
        r.Name = ip.Address.String()
        // ip.Server is nil if unassigned
    }
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `orphaned_ip` | `ip.Server == nil` |

### 5. Managed Databases (RDB)

**Service type**: `rdb_instance`

```go
func (c *Client) ScanDatabases(ctx context.Context, region scw.Region) ([]*models.Resource, error) {
    resp, err := c.rdbAPI.ListInstances(&rdb.ListInstancesRequest{
        Region: region,
    })
    // ...
    for _, db := range resp.Instances {
        r := models.NewResource(db.ID, "rdb_instance", string(region))
        r.Name = db.Name
        r.State = string(db.Status) // "ready", "provisioning", "error", etc.
        r.Tags = tagsToMap(db.Tags)
    }
}
```

**Available fields**:
- `db.ID`, `db.Name`
- `db.Status` — `ready`, `provisioning`, `configuring`, `deleting`, `error`, `autohealing`, `locked`, `initializing`, `disk_full`, `backuping`, `snapshotting`, `restarting`
- `db.Engine` — `PostgreSQL-15`, `MySQL-8`, etc.
- `db.NodeType` — e.g. `DB-DEV-S`
- `db.Volume.Size`, `db.Volume.Type`
- `db.IsHaCluster` — HA enabled
- `db.Endpoints` — connection endpoints with public/private info
- `db.BackupSchedule`
- `db.Tags`

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `public_access` | endpoint has public IP without IP allowlist |
| `unencrypted_resource` | encryption not enabled (check settings) |
| `missing_tag` | required tags missing |

### 6. Load Balancers

**Service type**: `load_balancer`

```go
func (c *Client) ScanLoadBalancers(ctx context.Context, zone scw.Zone) ([]*models.Resource, error) {
    resp, err := c.lbAPI.ListLBs(&lb.ZonedAPIListLBsRequest{Zone: zone})
    // ...
    for _, l := range resp.LBs {
        r := models.NewResource(l.ID, "load_balancer", string(zone))
        r.Name = l.Name
        r.State = string(l.Status)
        r.Tags = l.Tags // []string
    }
}
```

**Available fields**:
- `l.ID`, `l.Name`, `l.Status`
- `l.Type` — LB type
- `l.IP` — public IPs
- `l.Tags`
- `l.FrontendCount`, `l.BackendCount`
- `l.SslCompatibilityLevel`

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `idle_load_balancer` | `l.BackendCount == 0` |
| `insecure_tls` | `SslCompatibilityLevel` is too permissive |

### 7. Serverless Functions

**Service type**: `function`

```go
func (c *Client) ScanFunctions(ctx context.Context, region scw.Region) ([]*models.Resource, error) {
    // List namespaces first, then functions within each
    nsResp, err := c.functionAPI.ListNamespaces(...)
    for _, ns := range nsResp.Namespaces {
        fnResp, err := c.functionAPI.ListFunctions(...)
        for _, fn := range fnResp.Functions {
            r := models.NewResource(fn.ID, "function", string(region))
            r.Name = fn.Name
            r.State = string(fn.Status)
        }
    }
}
```

**Available fields**:
- `fn.ID`, `fn.Name`, `fn.Status`
- `fn.Runtime` — e.g. `node20`, `python311`, `go122`
- `fn.MemoryLimit` — in MB
- `fn.MinScale`, `fn.MaxScale`
- `fn.Timeout`
- `fn.HTTPOption` — `enabled`, `redirected`

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `oversized_function` | Memory limit is much larger than needed |

### 8. Object Storage

**Service type**: `object_storage_bucket`

Scaleway Object Storage is S3-compatible. Use the AWS S3 SDK with Scaleway endpoint:

```go
func (c *Client) ScanBuckets(ctx context.Context, region scw.Region) ([]*models.Resource, error) {
    // Use AWS S3 SDK with Scaleway endpoint
    cfg := aws.Config{
        Region: string(region),
        Credentials: credentials.NewStaticCredentialsProvider(
            c.creds.AccessKey, c.creds.SecretKey, "",
        ),
        BaseEndpoint: aws.String(fmt.Sprintf("https://s3.%s.scw.cloud", region)),
    }
    s3Client := s3.NewFromConfig(cfg)

    output, err := s3Client.ListBuckets(ctx, &s3.ListBucketsInput{})
    // ...
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `public_access` | Bucket ACL or policy allows public access |

### 9. Kubernetes (Kapsule)

**Service type**: `k8s_cluster`

```go
func (c *Client) ScanK8sClusters(ctx context.Context, region scw.Region) ([]*models.Resource, error) {
    resp, err := c.k8sAPI.ListClusters(&k8s.ListClustersRequest{Region: region})
    // ...
}
```

### 10. VPC / Private Networks

**Service type**: `private_network`

```go
func (c *Client) ScanPrivateNetworks(ctx context.Context, region scw.Region) ([]*models.Resource, error) {
    resp, err := c.vpcAPI.ListPrivateNetworks(&vpc.ListPrivateNetworksRequest{Region: region})
    // ...
}
```

---

## Dependency Mapping

| Source | Target | Relationship |
|--------|--------|-------------|
| Instance | Volume | `attached_to` (via `s.Volumes`) |
| Instance | Security Group | `uses_firewall_rule` (via `s.SecurityGroup`) |
| Instance | Private Network | `in_network` (via `s.PrivateNics`) |
| Instance | Flexible IP | `uses_eip` (via `ip.Server`) |
| Load Balancer | Instance | `targets` (via LB backends) |
| Function | Private Network | `in_network` (if VPC-connected) |
| RDB Instance | Private Network | `in_network` (via endpoints) |

---

## Regions and Zones

Scaleway uses a Region → Zone hierarchy:

| Region | Zones | City |
|--------|-------|------|
| `fr-par` | `fr-par-1`, `fr-par-2`, `fr-par-3` | Paris, France |
| `nl-ams` | `nl-ams-1`, `nl-ams-2`, `nl-ams-3` | Amsterdam, Netherlands |
| `pl-waw` | `pl-waw-1`, `pl-waw-2`, `pl-waw-3` | Warsaw, Poland |

**Important**: Some APIs are zoned (Instance, LB), others are regional (RDB, Functions, K8s). Scan accordingly:

```go
func (c *Client) ListRegions(ctx context.Context) ([]string, error) {
    return []string{"fr-par", "nl-ams", "pl-waw"}, nil
}

// For zoned APIs, iterate zones within each region
func zonesForRegion(region string) []scw.Zone {
    switch region {
    case "fr-par":
        return []scw.Zone{scw.ZoneFrPar1, scw.ZoneFrPar2, scw.ZoneFrPar3}
    case "nl-ams":
        return []scw.Zone{scw.ZoneNlAms1, scw.ZoneNlAms2, scw.ZoneNlAms3}
    case "pl-waw":
        return []scw.Zone{scw.ZonePlWaw1, scw.ZonePlWaw2, scw.ZonePlWaw3}
    }
    return nil
}
```

---

## Pricing

Scaleway does not have a public pricing API. Use static price tables:

```go
var scalewayInstancePrices = map[string]float64{
    "DEV1-S":  0.01,   // EUR/hour
    "DEV1-M":  0.02,
    "DEV1-L":  0.04,
    "DEV1-XL": 0.06,
    "GP1-S":   0.084,
    "GP1-M":   0.16,
    "GP1-L":   0.30,
    "GP1-XL":  0.60,
    // ...
}
```

Prices available on the Scaleway pricing page. Update periodically.

---

## Scanner Types for UI

```go
var ScalewayScannerTypes = []ScannerTypeInfo{
    {ID: "instance",       Label: "Instances",         Description: "Compute instances and volumes"},
    {ID: "security_group", Label: "Security Groups",   Description: "Security groups and rules"},
    {ID: "network",        Label: "Networking",         Description: "Private networks, IPs, load balancers"},
    {ID: "rdb",            Label: "Databases",          Description: "Managed database instances (PostgreSQL, MySQL)"},
    {ID: "function",       Label: "Serverless",         Description: "Serverless functions and containers"},
    {ID: "object_storage", Label: "Object Storage",     Description: "S3-compatible object storage buckets"},
    {ID: "k8s",            Label: "Kubernetes",          Description: "Kapsule Kubernetes clusters"},
}
```

---

## Analyzer Compatibility

| Analyzer | Compatible | Notes |
|----------|-----------|-------|
| Orphans | Yes | Orphaned volumes, flexible IPs |
| SSL | Partial | No native cert manager, but LB certs have expiry |
| Security | Yes | Security group rule analysis, public DB access |
| Cost | Yes | Stopped instances, orphaned resources |
| Tagging | Yes | Scaleway tags (convert `[]string` to `map[string]string`) |
| Residency | Yes | Compare zone to allowed regions |
| IAM | Partial | Can check API key age, but IAM is simpler than AWS |

---

## Implementation Checklist

- [ ] `workers/internal/providers/scaleway/provider.go` — implements `Provider` interface
- [ ] `workers/internal/providers/scaleway/client.go` — SDK client wrapper
- [ ] `workers/internal/providers/scaleway/instance.go` — instances + volumes + flexible IPs
- [ ] `workers/internal/providers/scaleway/security_group.go` — security groups + rules
- [ ] `workers/internal/providers/scaleway/rdb.go` — managed databases
- [ ] `workers/internal/providers/scaleway/lb.go` — load balancers
- [ ] `workers/internal/providers/scaleway/function.go` — serverless functions
- [ ] `workers/internal/providers/scaleway/object_storage.go` — S3-compatible buckets
- [ ] `workers/internal/providers/scaleway/k8s.go` — Kapsule clusters
- [ ] `workers/internal/providers/scaleway/network.go` — private networks
- [ ] `workers/internal/providers/scaleway/dependencies.go` — dependency extractor
- [ ] `apps/api/src/routes/` — Scaleway credential validation
- [ ] `apps/app/src/components/` — Scaleway credential form (access key + secret key + project ID)
- [ ] `apps/app/src/components/` — Scaleway setup instructions
- [ ] Static pricing tables
- [ ] Tests for each scanner
- [ ] Tag conversion utility (`[]string` → `map[string]string`)

---

## Key Differences from AWS

| Aspect | AWS | Scaleway |
|--------|-----|----------|
| Auth | Role assumption (STS) | Static API keys |
| Tags | `map[string]string` | `[]string` (key=value format) |
| Regions | 20+ regions, separate endpoints | 3 regions, 9 zones |
| API structure | Per-service SDKs | Per-product Go packages |
| IAM | Complex (policies, roles, groups) | Simple (project-scoped) |
| Object Storage | Native S3 API | S3-compatible, different endpoint |
| Networking | VPC, SG, NACL | VPC, Security Groups (simpler) |

---

## Estimated Effort

**Small-Medium** — 5-8 days for an experienced developer.

- ~8 scannable resource types
- Simple auth (API keys, no token refresh)
- 3 regions × 3 zones = 9 scan targets
- Need S3-compatible client for object storage
- Tag conversion layer needed
- No public pricing API (static tables)
