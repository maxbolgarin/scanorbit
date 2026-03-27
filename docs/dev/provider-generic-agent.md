# Generic Host Agent — "Any Provider" Scanner

## The Idea

Most small-to-medium businesses don't use AWS/GCP/Azure. They have VPS instances on DigitalOcean, OVH, Linode, Vultr, Contabo, or even bare metal from a local ISP. There's no API to scan — but there's **SSH access to the machine itself**.

ScanOrbit can offer a lightweight diagnostic script (or a Go binary) that users run on their servers. The script collects system-level data, normalizes it into ScanOrbit's resource/finding model, and uploads the results via the public API. No cloud credentials needed.

This turns ScanOrbit from "cloud infrastructure scanner" into "infrastructure scanner" — period.

---

## Architecture Options

### Option A: One-Shot Diagnostic Script (Recommended for MVP)

User runs a single shell script. It collects data, outputs JSON, and POSTs to ScanOrbit API.

```
User's server                          ScanOrbit
┌─────────────────┐                    ┌──────────────┐
│  curl | bash     │ ──── HTTPS ─────→ │  POST /api/  │
│  (or download    │    JSON payload    │  v1/agent/   │
│   and run)       │                    │  report      │
└─────────────────┘                    └──────────────┘
```

**Pros**: Zero installation, works everywhere, user sees exactly what runs, no persistent agent
**Cons**: No continuous monitoring, user must re-run periodically

### Option B: Cron-Based Agent

Same script, but user adds it to cron for periodic scans:

```bash
# Every 6 hours
0 */6 * * * /usr/local/bin/scanorbit-agent --api-key=so_xxx --org=xxx 2>/dev/null
```

### Option C: Lightweight Go Binary (Future)

A compiled Go binary that runs as a systemd service. Supports continuous monitoring, real-time alerts, and richer data collection (process monitoring, file integrity, etc.). Higher barrier to adoption but more powerful.

**Recommendation**: Start with **Option A** (shell script), add **Option B** (cron) as a trivial extension, build **Option C** later if there's demand.

---

## What the Script Collects

### Resource Discovery (maps to ScanOrbit `resources` table)

| Check | Service Type | How | Example Output |
|-------|-------------|-----|---------------|
| **Host itself** | `host` | `hostname`, `uname`, `/etc/os-release` | name, OS, arch, kernel |
| **CPU/RAM** | `host` | `/proc/cpuinfo`, `/proc/meminfo`, `nproc` | 4 cores, 8GB RAM |
| **Disks/Volumes** | `disk` | `lsblk -J`, `df -h`, `mount` | /dev/sda1 50GB, /dev/sdb 100GB |
| **Network interfaces** | `network_interface` | `ip -j addr`, `ip -j route` | eth0: 10.0.0.5, public: 203.0.113.1 |
| **Listening ports** | `service` | `ss -tlnp` | nginx:80, postgres:5432, sshd:22 |
| **Running services** | `service` | `systemctl list-units --type=service --state=running` | nginx, postgresql, docker |
| **Docker containers** | `container` | `docker ps --format json` (if docker available) | app:latest, postgres:15 |
| **SSL certificates** | `certificate` | scan local cert files + listening TLS ports | /etc/ssl/certs/..., nginx certs |
| **Firewall rules** | `firewall_rule` | `iptables -L -n`, `nft list ruleset`, `ufw status` | 22/tcp ACCEPT, 80/tcp ACCEPT |
| **Users** | `user` | `/etc/passwd`, `last`, `who` | root, deploy, app |
| **SSH config** | `ssh_config` | `/etc/ssh/sshd_config` | PermitRootLogin, PasswordAuth |
| **Cron jobs** | `cron_job` | `/etc/crontab`, `crontab -l`, `/etc/cron.d/` | Backup scripts, cert renewal |
| **Package list** | `package` | `dpkg -l` / `rpm -qa` | openssl 3.0.2, nginx 1.24 |
| **DNS resolvers** | `dns_config` | `/etc/resolv.conf` | 8.8.8.8, 1.1.1.1 |

### Finding Detection (maps to ScanOrbit `findings` table)

#### Security Findings

| Finding | Severity | Detection Method |
|---------|----------|-----------------|
| **SSH root login enabled** | high | `grep -i PermitRootLogin /etc/ssh/sshd_config` |
| **SSH password auth enabled** | medium | `grep -i PasswordAuthentication /etc/ssh/sshd_config` |
| **No firewall active** | high | Check iptables rules count, ufw status, nftables |
| **Open sensitive ports** | high | `ss -tlnp` — DB ports (3306, 5432, 27017, 6379) on 0.0.0.0 |
| **SSL cert expiring** | high/critical | OpenSSL check on cert files and TLS endpoints |
| **Outdated SSL/TLS** | medium | Check for TLS 1.0/1.1 in nginx/apache/haproxy configs |
| **Unattended upgrades disabled** | medium | Check if `unattended-upgrades` is installed and active |
| **World-readable sensitive files** | high | Check perms on `/etc/shadow`, SSH keys, `.env` files |
| **Default/weak SSH port** | low | SSH on port 22 (informational) |
| **No fail2ban** | medium | Check if fail2ban is installed and running |
| **Running as root** | medium | Services running as root that shouldn't be |
| **Docker socket exposed** | critical | Check if Docker socket is network-accessible |
| **Unencrypted disk** | medium | Check LUKS encryption on data volumes |
| **Insecure kernel parameters** | medium | Check `sysctl` settings (IP forwarding, SYN cookies, etc.) |
| **No swap or excessive swap** | low | Check swap configuration |

#### Cost/Optimization Findings

| Finding | Severity | Detection Method |
|---------|----------|-----------------|
| **Disk almost full** | high | `df` shows >85% usage |
| **High memory usage** | medium | `/proc/meminfo` shows >90% used |
| **Zombie processes** | low | `ps aux` for zombie state |
| **Unused disk volumes** | medium | Mounted volumes with no recent I/O |
| **Large log files** | low | Files >1GB in `/var/log/` |
| **No log rotation** | medium | Check logrotate config |
| **Unused packages** | low | Orphaned packages (`apt autoremove --dry-run`) |
| **Old kernel versions** | low | Multiple kernels installed |

#### Compliance Findings

| Finding | Severity | Detection Method |
|---------|----------|-----------------|
| **No backup configured** | medium | Check for backup scripts/tools (restic, borgbackup, cron backups) |
| **NTP not synced** | low | `timedatectl`, `chronyc tracking` |
| **Audit logging disabled** | medium | Check auditd status |
| **Core dumps enabled** | low | Check `/proc/sys/kernel/core_pattern` |

---

## Script Design

### Shell Script (POSIX-compatible)

```bash
#!/bin/sh
# ScanOrbit Agent Scanner v1.0
# Collects system diagnostics and reports to ScanOrbit
# Usage: curl -sL https://scanorbit.com/agent.sh | sh -s -- --api-key=so_xxx

set -eu

SCANORBIT_API="${SCANORBIT_API:-https://app.scanorbit.com}"
API_KEY=""
HOST_ID=""
DRY_RUN=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --api-key=*) API_KEY="${arg#*=}" ;;
    --host-id=*) HOST_ID="${arg#*=}" ;;
    --dry-run)   DRY_RUN=true ;;
    --help)      usage; exit 0 ;;
  esac
done

# ---- Collectors ----

collect_host_info() {
  hostname=$(hostname -f 2>/dev/null || hostname)
  os=$(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -s)
  kernel=$(uname -r)
  arch=$(uname -m)
  uptime_seconds=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)
  cpus=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 1)
  mem_total_kb=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
  mem_avail_kb=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}')
  # ... output JSON
}

collect_disks() {
  lsblk -Jb 2>/dev/null || df -B1 --output=source,size,used,avail,target 2>/dev/null
}

collect_listening_ports() {
  ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null
}

collect_firewall() {
  iptables -L -n 2>/dev/null
  nft list ruleset 2>/dev/null
  ufw status verbose 2>/dev/null
}

collect_ssl_certs() {
  # Check nginx/apache cert paths
  # Check Let's Encrypt certs
  # Probe localhost TLS ports
  for port in 443 8443 993 995 465 587; do
    echo | timeout 3 openssl s_client -connect localhost:$port 2>/dev/null | \
      openssl x509 -noout -dates -subject 2>/dev/null
  done
}

collect_ssh_config() {
  cat /etc/ssh/sshd_config 2>/dev/null | grep -iE \
    'PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|Port |AllowUsers|AllowGroups'
}

collect_users() {
  # System users with login shells
  awk -F: '$7 !~ /(nologin|false)/ {print $1":"$3":"$6":"$7}' /etc/passwd 2>/dev/null
}

collect_docker() {
  if command -v docker >/dev/null 2>&1; then
    docker ps --format '{{json .}}' 2>/dev/null
  fi
}

collect_services() {
  if command -v systemctl >/dev/null 2>&1; then
    systemctl list-units --type=service --state=running --no-pager --plain 2>/dev/null
  fi
}

# ---- Analyzers ----

analyze_ssh() {
  config=$(cat /etc/ssh/sshd_config 2>/dev/null)
  # PermitRootLogin yes → finding
  # PasswordAuthentication yes → finding
}

analyze_firewall() {
  rules_count=$(iptables -L -n 2>/dev/null | grep -c -v '^$\|^Chain\|^target' || echo 0)
  nft_count=$(nft list ruleset 2>/dev/null | grep -c 'rule' || echo 0)
  ufw_active=$(ufw status 2>/dev/null | grep -c 'Status: active' || echo 0)
  if [ "$rules_count" -eq 0 ] && [ "$nft_count" -eq 0 ] && [ "$ufw_active" -eq 0 ]; then
    # No firewall → high severity finding
  fi
}

analyze_open_ports() {
  # Check for DB ports listening on 0.0.0.0
  ss -tlnp 2>/dev/null | awk '$4 ~ /0\.0\.0\.0:(3306|5432|27017|6379|9200|11211|5672)/'
}

analyze_disk_usage() {
  df -h 2>/dev/null | awk 'NR>1 && int($5) > 85 {print $6, $5}'
}

# ---- Main ----

# Collect everything into JSON
report=$(cat <<REPORT_EOF
{
  "version": "1.0",
  "collected_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "host": $(collect_host_info),
  "disks": $(collect_disks),
  "ports": $(collect_listening_ports),
  "firewall": $(collect_firewall),
  "ssl_certs": $(collect_ssl_certs),
  "ssh_config": $(collect_ssh_config),
  "users": $(collect_users),
  "docker": $(collect_docker),
  "services": $(collect_services),
  "findings": $(run_all_analyzers)
}
REPORT_EOF
)

if [ "$DRY_RUN" = true ]; then
  echo "$report" | jq .
  exit 0
fi

# Upload to ScanOrbit
curl -s -X POST "$SCANORBIT_API/api/v1/agent/report" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$report"
```

### Key Design Principles

1. **POSIX sh** — no bash-isms, works on Alpine, Debian, RHEL, Ubuntu, anything
2. **No dependencies** — uses only standard Unix tools (`ss`, `awk`, `grep`, `openssl`)
3. **Read-only** — never modifies anything, never writes to disk
4. **Transparent** — user can read the script before running (`--dry-run` shows output)
5. **Minimal permissions** — runs as the current user, some checks need root (firewall, shadow file)
6. **Idempotent** — safe to run repeatedly

---

## API Endpoint Design

### New endpoint: `POST /api/v1/agent/report`

```typescript
// Route: apps/api/src/routes/publicApi.ts

// Accept agent scan report
app.post('/api/v1/agent/report', apiKeyAuth, async (c) => {
  const body = await c.req.json<AgentReport>();

  // 1. Find or create cloud_account with provider='agent'
  // 2. Create scan record
  // 3. Upsert resources from report
  // 4. Store findings from report
  // 5. Complete scan
});
```

### Report Schema

```typescript
interface AgentReport {
  version: string;                    // "1.0"
  collectedAt: string;               // ISO timestamp
  hostId?: string;                   // Optional stable host identifier
  host: {
    hostname: string;
    os: string;                      // "Ubuntu 24.04 LTS"
    kernel: string;                  // "6.8.0-40-generic"
    arch: string;                    // "x86_64"
    cpus: number;
    memoryMB: number;
    uptimeSeconds: number;
  };
  resources: AgentResource[];
  findings: AgentFinding[];
}

interface AgentResource {
  type: string;                      // "host", "disk", "service", "container", "certificate", etc.
  id: string;                        // stable identifier (hostname, disk path, service name)
  name: string;
  state: string;                     // "running", "stopped", "active", etc.
  region: string;                    // hostname or IP (for display grouping)
  tags: Record<string, string>;      // user-defined labels
  raw: Record<string, unknown>;      // full collected data
}

interface AgentFinding {
  type: string;                      // reuse existing finding types + new host-specific ones
  severity: string;                  // critical, high, medium, low
  summary: string;                   // human-readable description
  details: Record<string, unknown>;  // structured details
  resourceId: string;                // reference to AgentResource.id
}
```

---

## How It Fits the Data Model

### Account

```
cloud_accounts:
  provider = 'agent'
  account_identifier = hostname or user-chosen name
  credentials = {} (empty — no cloud credentials needed)
  status = 'ok' (always, since there's no connection test)
```

### Resource Mapping

| Agent Resource Type | DB `service` | Notes |
|-------------------|-------------|-------|
| `host` | `host` | The VM/server itself |
| `disk` | `disk` | `/dev/sda`, `/dev/vdb`, etc. |
| `service` | `system_service` | nginx, postgresql, docker, sshd |
| `container` | `container` | Docker containers |
| `certificate` | `certificate` | SSL/TLS certs found on disk or via TLS probe |
| `firewall_rule` | `firewall_rule` | iptables/nft/ufw rules |
| `user` | `system_user` | Local user accounts |
| `network_interface` | `network_interface` | eth0, ens3, etc. |
| `cron_job` | `cron_job` | Scheduled tasks |

### Finding Type Mapping

Reuse existing types where applicable, add new host-specific ones:

```typescript
// Reusable from cloud providers
'ssl_expiry'              // cert expiring on the host
'unencrypted_resource'    // unencrypted disk
'open_all_ports'          // no firewall / all ports open
'public_access'           // DB port bound to 0.0.0.0

// New host-specific finding types
'ssh_root_login'          // PermitRootLogin yes
'ssh_password_auth'       // PasswordAuthentication yes
'no_firewall'             // no iptables/nft/ufw rules
'disk_almost_full'        // >85% usage
'no_fail2ban'             // no brute-force protection
'service_as_root'         // service running as root
'world_readable_secrets'  // sensitive files with bad perms
'no_auto_updates'         // unattended-upgrades not configured
'outdated_packages'       // packages with known CVEs
'no_backup_tool'          // no backup software detected
'large_log_files'         // log files > 1GB
'no_log_rotation'         // logrotate not configured
'docker_socket_exposed'   // Docker socket network-accessible
'insecure_kernel_param'   // dangerous sysctl values
'ntp_not_synced'          // time not synchronized
'no_audit_logging'        // auditd not running
```

---

## Dependencies Between Resources

| Source | Target | Relationship |
|--------|--------|-------------|
| Service (nginx) | Certificate | `uses_certificate` |
| Service (nginx) | Network Interface | `listens_on` |
| Container | Host | `runs_on` |
| Disk | Host | `attached_to` |
| Service | User | `runs_as` |
| Service | Cron Job | `scheduled_by` |

---

## User Experience

### Onboarding Flow

```
1. User creates account in ScanOrbit
2. Goes to "Add Account" → selects "Generic / Any Provider"
3. Enters a name for this host (e.g. "Production Web Server")
4. Gets an API key + one-liner command:

   curl -sL https://scanorbit.com/agent.sh | sh -s -- \
     --api-key=so_xxx_yyy \
     --host-id=my-web-server

5. Runs it on their server
6. Results appear in ScanOrbit dashboard within seconds
7. Optional: copy the cron line for recurring scans
```

### Dashboard Display

- Provider badge shows "Agent" or a server icon
- Resources show host-level items (disks, services, ports, containers)
- Findings show security hardening recommendations
- Infrastructure map shows host → services → containers hierarchy

---

## Security Considerations

1. **Script transparency**: Host the script on GitHub, checksum-verify before running
2. **No data exfiltration**: Script never reads file contents — only configs, metadata, ports
3. **Rate limiting**: Agent report endpoint should be rate-limited (1 report per host per 5 min)
4. **Report size limit**: Max 1MB per report to prevent abuse
5. **API key scoping**: Agent API keys could be a separate type with write-only access to the report endpoint
6. **Sensitive data filtering**: Script should never collect passwords, private keys, or environment variable values — only their existence

---

## Competitive Positioning

| Tool | Model | Cost | Scope |
|------|-------|------|-------|
| **Lynis** | Open source CLI | Free | Host hardening audit |
| **Wazuh** | Open source SIEM | Free (self-hosted) | Full SIEM, complex setup |
| **ScoutSuite** | Open source | Free | Cloud-only (AWS/GCP/Azure) |
| **ScanOrbit Agent** | SaaS + script | Freemium | Cloud + generic hosts, zero setup |

**ScanOrbit's advantage**: One dashboard for cloud accounts AND standalone servers. No need to set up Grafana/Prometheus/Wazuh. Run a script, see results.

---

## Implementation Plan

### Phase 1: Shell Script MVP (1-2 weeks)

1. Write the POSIX sh collection script (~300 lines)
2. Add `POST /api/v1/agent/report` API endpoint
3. Create `provider='agent'` account type in DB
4. Server-side analysis: parse report and generate findings
5. Display agent accounts and findings in the existing dashboard

### Phase 2: Cron + Repeat Scans (1 week)

6. Add `--cron-install` flag to script (writes crontab entry)
7. Track scan history for agent accounts (same as cloud accounts)
8. Diff detection between scans (new findings, resolved findings)

### Phase 3: Binary Agent (future)

9. Compile Go binary with richer collection (process monitoring, file integrity)
10. Systemd service for continuous monitoring
11. Real-time alerts via webhooks

### Phase 4: Ansible Playbook (future)

12. Ansible playbook that runs the script across multiple hosts
13. Bulk onboarding: scan 50 servers with one command

---

## Alternative: Ansible Integration

Instead of (or in addition to) a shell script, provide an Ansible playbook:

```yaml
# scanorbit-scan.yml
- name: ScanOrbit Host Scan
  hosts: all
  become: yes
  gather_facts: yes
  tasks:
    - name: Collect system info
      setup:
        gather_subset:
          - hardware
          - network
          - virtual
          - distribution

    - name: Check listening ports
      command: ss -tlnp
      register: ports

    - name: Check SSH config
      slurp:
        src: /etc/ssh/sshd_config
      register: ssh_config

    - name: Check firewall
      command: iptables -L -n
      register: firewall
      ignore_errors: yes

    - name: Check SSL certificates
      # ... scan TLS ports

    - name: Upload report to ScanOrbit
      uri:
        url: "https://app.scanorbit.com/api/v1/agent/report"
        method: POST
        headers:
          Authorization: "Bearer {{ scanorbit_api_key }}"
        body_format: json
        body: "{{ report | to_json }}"
```

**Pros**: Works across many hosts, familiar tool for DevOps
**Cons**: Requires Ansible installed, more complex than a single script

---

## Estimated Effort

| Phase | Effort | Value |
|-------|--------|-------|
| Shell script + API endpoint | 1-2 weeks | MVP, immediate value |
| Dashboard integration | 1 week | Visual results |
| Cron support | 2-3 days | Recurring scans |
| Ansible playbook | 1 week | Multi-host scanning |
| Go binary agent | 2-3 weeks | Richer data, continuous monitoring |

**Start with the shell script**. It's the lowest friction onboarding possible — a single `curl | sh` command — and immediately differentiates ScanOrbit from cloud-only scanners.
