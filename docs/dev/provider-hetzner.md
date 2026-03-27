# Hetzner Cloud Provider — Development Guide

Hetzner is the simplest provider to implement and should be the **first non-AWS provider** to validate the multi-cloud plugin architecture.

---

## Overview

| Aspect | Details |
|--------|---------|
| **Authentication** | Single API token (bearer token) |
| **Go SDK** | `github.com/hetznercloud/hcloud-go/v2/hcloud` |
| **API** | REST, JSON, `https://api.hetzner.cloud/v1` |
| **Rate Limits** | 3600 requests/hour per token |
| **Regions** | `eu-central` (fsn1, nbg1), `eu-west` (hel1), `us-east` (ash), `us-west` (hil), `ap-southeast` (sin) |
| **IAM** | No IAM model — single token = full project access |
| **Complexity** | Low — ~5 scannable resource types, simple flat API |

---

## Authentication

Hetzner uses a single API token per project. No role assumption, no service accounts, no federated identity.

### Credential Shape

```json
{
  "apiToken": "encrypted:..."
}
```

### Token Creation

Users create tokens in the Hetzner Cloud Console → Project → Security → API Tokens. Tokens are either **read-only** or **read/write**. ScanOrbit needs **read-only** tokens.

### Connection Test

```go
func (c *HetznerClient) TestConnection(ctx context.Context) error {
    // Simple: list servers with limit=1 to verify token is valid
    _, _, err := c.client.Server.List(ctx, hcloud.ServerListOpts{
        ListOpts: hcloud.ListOpts{PerPage: 1},
    })
    return err
}
```

### Setup Instructions (for UI)

```
1. Go to Hetzner Cloud Console → your project
2. Navigate to Security → API Tokens
3. Click "Generate API Token"
4. Name: "ScanOrbit Scanner"
5. Permission: Read (read-only is sufficient)
6. Copy the token and paste it below
```

---

## Go SDK Usage

### Installation

```bash
go get github.com/hetznercloud/hcloud-go/v2/hcloud
```

### Client Setup

```go
package hetzner

import (
    "context"
    "encoding/json"
    "fmt"
    "github.com/hetznercloud/hcloud-go/v2/hcloud"
)

type HetznerCredentials struct {
    APIToken string `json:"apiToken"`
}

type Client struct {
    hc     *hcloud.Client
    logger zerolog.Logger
}

func NewClient(ctx context.Context, credsJSON json.RawMessage, logger zerolog.Logger) (*Client, error) {
    var creds HetznerCredentials
    if err := json.Unmarshal(credsJSON, &creds); err != nil {
        return nil, fmt.Errorf("parse credentials: %w", err)
    }
    if creds.APIToken == "" {
        return nil, fmt.Errorf("apiToken is required")
    }

    hc := hcloud.NewClient(hcloud.WithToken(creds.APIToken))

    return &Client{hc: hc, logger: logger}, nil
}
```

### Key SDK Patterns

The hcloud-go SDK uses a consistent pattern for all resources:

```go
// List with pagination
servers, _, err := client.Server.List(ctx, hcloud.ServerListOpts{
    ListOpts: hcloud.ListOpts{PerPage: 50, Page: 1},
})

// All pages helper
servers, err := client.Server.All(ctx)  // fetches all pages automatically

// Get by ID
server, _, err := client.Server.GetByID(ctx, 12345)
```

---

## Scannable Resources

### 1. Servers (Primary)

**Service type**: `server`

```go
func (c *Client) ScanServers(ctx context.Context) ([]*models.Resource, error) {
    servers, err := c.hc.Server.All(ctx)
    if err != nil {
        return nil, fmt.Errorf("list servers: %w", err)
    }

    var resources []*models.Resource
    for _, s := range servers {
        r := models.NewResource(
            fmt.Sprintf("hcloud-server-%d", s.ID),
            "server",
            s.Datacenter.Location.Name,  // e.g. "fsn1"
        )
        r.Name = s.Name
        r.State = string(s.Status)  // "running", "off", "initializing", etc.
        r.Tags = s.Labels           // Hetzner uses "labels" (map[string]string)
        r.CostEstimateMonthly = getServerPrice(s.ServerType, s.Datacenter.Location)
        r.Raw = marshalJSON(s)
        resources = append(resources, r)
    }
    return resources, nil
}
```

**Available fields**:
- `s.ID` — integer ID
- `s.Name` — server name
- `s.Status` — `running`, `off`, `initializing`, `starting`, `stopping`, `migrating`, `rebuilding`, `deleting`, `unknown`
- `s.ServerType.Name` — e.g. `cx22`, `cpx11`, `cax11`
- `s.ServerType.Cores`, `.Memory`, `.Disk` — specs
- `s.Datacenter.Name` — e.g. `fsn1-dc14`
- `s.Datacenter.Location.Name` — e.g. `fsn1`
- `s.PublicNet.IPv4.IP`, `.IPv6.IP` — public IPs
- `s.PrivateNet` — private network attachments
- `s.Labels` — `map[string]string` (equivalent to AWS tags)
- `s.Volumes` — attached volume IDs
- `s.Image` — OS image info
- `s.Created` — creation time
- `s.LoadBalancers` — attached LBs (v2.7+)

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `stopped_instance` | `s.Status == "off"` for >7 days |
| `missing_tag` | required labels missing |
| `old_gen_instance` | server type is deprecated generation |

### 2. Volumes

**Service type**: `volume`

```go
func (c *Client) ScanVolumes(ctx context.Context) ([]*models.Resource, error) {
    volumes, err := c.hc.Volume.All(ctx)
    // ...
    for _, v := range volumes {
        r := models.NewResource(
            fmt.Sprintf("hcloud-volume-%d", v.ID),
            "volume",
            v.Location.Name,
        )
        r.Name = v.Name
        r.State = string(v.Status) // "creating", "available"
        r.Tags = v.Labels
        r.CostEstimateMonthly = float64(v.Size) * pricePerGBMonth
        r.Raw = marshalJSON(v)
    }
}
```

**Available fields**:
- `v.ID`, `v.Name`, `v.Size` (GB)
- `v.Status` — `creating`, `available`
- `v.Server` — attached server (nil if orphaned)
- `v.Location.Name` — region
- `v.Labels`
- `v.LinuxDevice` — device path
- `v.Created`
- `v.Format` — filesystem format (ext4, xfs)

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `orphaned_volume` | `v.Server == nil` for >7 days |
| `missing_tag` | required labels missing |

### 3. Floating IPs

**Service type**: `floating_ip`

```go
func (c *Client) ScanFloatingIPs(ctx context.Context) ([]*models.Resource, error) {
    ips, err := c.hc.FloatingIP.All(ctx)
    // ...
    for _, ip := range ips {
        r := models.NewResource(
            fmt.Sprintf("hcloud-fip-%d", ip.ID),
            "floating_ip",
            ip.HomeLocation.Name,
        )
        r.Name = ip.Name
        r.State = "active" // Floating IPs don't have a status field
        r.Tags = ip.Labels
    }
}
```

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `orphaned_ip` | `ip.Server == nil` (not assigned to any server) |

### 4. Load Balancers

**Service type**: `load_balancer`

```go
func (c *Client) ScanLoadBalancers(ctx context.Context) ([]*models.Resource, error) {
    lbs, err := c.hc.LoadBalancer.All(ctx)
    // ...
    for _, lb := range lbs {
        r := models.NewResource(
            fmt.Sprintf("hcloud-lb-%d", lb.ID),
            "load_balancer",
            lb.Location.Name,
        )
        r.Name = lb.Name
        r.State = "active"
        r.Tags = lb.Labels
    }
}
```

**Available fields**:
- `lb.ID`, `lb.Name`
- `lb.LoadBalancerType.Name` — e.g. `lb11`
- `lb.Location.Name` — region
- `lb.Targets` — target servers
- `lb.Services` — listener/health check configs
- `lb.Algorithm.Type` — `round_robin`, `least_connections`
- `lb.PublicNet` — public IP
- `lb.Labels`

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `idle_load_balancer` | `len(lb.Targets) == 0` (no backends) |
| `missing_tag` | required labels missing |

### 5. Firewalls

**Service type**: `firewall`

```go
func (c *Client) ScanFirewalls(ctx context.Context) ([]*models.Resource, error) {
    firewalls, err := c.hc.Firewall.All(ctx)
    // ...
    for _, fw := range firewalls {
        r := models.NewResource(
            fmt.Sprintf("hcloud-fw-%d", fw.ID),
            "firewall",
            "global",  // Firewalls are not region-specific
        )
        r.Name = fw.Name
        r.State = "active"
        r.Tags = fw.Labels
        r.Raw = marshalJSON(fw) // Store rules for security analysis
    }
}
```

**Available fields**:
- `fw.Rules` — `[]FirewallRule` with `Direction` (in/out), `Protocol`, `Port`, `SourceIPs`/`DestinationIPs`
- `fw.AppliedTo` — servers and label selectors this firewall applies to

**Findings**:
| Finding Type | Condition |
|-------------|-----------|
| `permissive_firewall_rule` | Rule allows `0.0.0.0/0` or `::/0` on sensitive ports |
| `open_all_ports` | Rule allows all ports from `0.0.0.0/0` |
| `unused_security_group` | `len(fw.AppliedTo) == 0` |

### 6. Networks (Private)

**Service type**: `network`

```go
func (c *Client) ScanNetworks(ctx context.Context) ([]*models.Resource, error) {
    networks, err := c.hc.Network.All(ctx)
    // ...
}
```

**Fields**: `n.IPRange`, `n.Subnets`, `n.Routes`, `n.Servers`, `n.Labels`

### 7. SSH Keys

**Service type**: `ssh_key`

Informational only — no findings to generate, but useful for inventory.

### 8. Primary IPs

**Service type**: `primary_ip`

Similar to floating IPs but tied to server lifecycle. Can be orphaned when a server is deleted with "keep IP" option.

### 9. Certificates

**Service type**: `certificate`

```go
func (c *Client) ScanCertificates(ctx context.Context) ([]*models.Certificate, error) {
    certs, err := c.hc.Certificate.All(ctx)
    // ...
    for _, cert := range certs {
        // cert.NotValidAfter → ssl_expiry finding
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
| Server | Volume | `attached_to` (via `s.Volumes`) |
| Server | Network | `in_network` (via `s.PrivateNet`) |
| Server | Floating IP | `uses_eip` (via `fip.Server`) |
| Server | Firewall | `uses_firewall_rule` (via `fw.AppliedTo`) |
| Server | Load Balancer | `targets` (via `lb.Targets`) |
| Load Balancer | Certificate | `uses_certificate` (via LB services) |

---

## Regions

Hetzner uses a datacenter → location hierarchy:

| Location | City | Datacenters |
|----------|------|-------------|
| `fsn1` | Falkenstein, DE | `fsn1-dc14` |
| `nbg1` | Nuremberg, DE | `nbg1-dc3` |
| `hel1` | Helsinki, FI | `hel1-dc2` |
| `ash` | Ashburn, US | `ash-dc1` |
| `hil` | Hillsboro, US | `hil-dc1` |
| `sin` | Singapore, SG | `sin-dc1` |

```go
func (c *Client) ListRegions(ctx context.Context) ([]string, error) {
    // Hetzner doesn't have regional endpoints — single API, all resources globally visible
    // Return locations for regional categorization
    locations, err := c.hc.Location.All(ctx)
    if err != nil {
        return nil, err
    }
    var regions []string
    for _, loc := range locations {
        regions = append(regions, loc.Name)
    }
    return regions, nil
}
```

**Important**: Unlike AWS, Hetzner's API is global — one call returns resources across all datacenters. No need for per-region scanning. The `ScanGlobal` method should do all the work, and `Scan(region)` can be a no-op or filter by location.

---

## Pricing

Hetzner has a built-in pricing API:

```go
pricing, _, err := client.Pricing.Get(ctx)
// pricing.ServerTypes — per server type monthly/hourly pricing
// pricing.Volume — per GB monthly pricing
// pricing.FloatingIP — monthly pricing
// pricing.LoadBalancerTypes — per LB type pricing
// pricing.PrimaryIPs — per IP type pricing
```

This eliminates the need for static price tables.

---

## Scanner Types for UI

```go
var HetznerScannerTypes = []ScannerTypeInfo{
    {ID: "server",       Label: "Servers",        Description: "Cloud servers (instances)"},
    {ID: "volume",       Label: "Volumes",        Description: "Block storage volumes"},
    {ID: "network",      Label: "Networking",      Description: "Firewalls, floating IPs, load balancers, networks"},
    {ID: "certificate",  Label: "Certificates",    Description: "SSL/TLS certificates"},
}
```

---

## Analyzer Compatibility

| Analyzer | Compatible | Notes |
|----------|-----------|-------|
| Orphans | Yes | Orphaned volumes, floating IPs |
| SSL | Yes | Certificate expiry via `hc.Certificate.All()` |
| Security | Yes | Firewall rule analysis |
| Cost | Yes | Stopped instances, orphaned resources, pricing API available |
| Tagging | Yes | Hetzner labels ≡ AWS tags |
| Residency | Yes | Compare `location` to allowed regions |
| IAM | **No** | Hetzner has no IAM — skip entirely |

---

## Implementation Checklist

- [ ] `workers/internal/providers/hetzner/provider.go` — implements `Provider` interface
- [ ] `workers/internal/providers/hetzner/client.go` — hcloud-go wrapper
- [ ] `workers/internal/providers/hetzner/server.go` — server scanner
- [ ] `workers/internal/providers/hetzner/volume.go` — volume scanner
- [ ] `workers/internal/providers/hetzner/network.go` — firewalls, floating IPs, networks, load balancers
- [ ] `workers/internal/providers/hetzner/certificate.go` — certificate scanner
- [ ] `workers/internal/providers/hetzner/dependencies.go` — dependency extractor
- [ ] `apps/api/src/routes/` — add Hetzner credential validation
- [ ] `apps/app/src/components/` — Hetzner credential form (just an API token input)
- [ ] `apps/app/src/components/` — Hetzner setup instructions
- [ ] Tests for each scanner
- [ ] Integration test with mock Hetzner API

---

## Estimated Effort

**Small** — 3-5 days for an experienced developer.

- ~5 scannable resource types (vs 11 for AWS)
- Simple auth (single token, no role assumption)
- Global API (no per-region scanning)
- Built-in pricing API
- No IAM model to scan
- Good Go SDK with consistent patterns
