# Terraform Two-Layer Architecture

Backup isolation for ScanOrbit infrastructure on Scaleway. A single `terraform destroy` on Layer 2 cannot touch backups, DNS, or IAM identities.

## Architecture Overview

```
terraform/
├── bootstrap/           # State bucket (run once, local state)
├── layer1-backup/       # Backup bucket, IAM, DNS (admin-only)
├── layer2-server/       # Instances, networking (daily deploy credentials)
└── scripts/restore.sh   # Semi-automated disaster recovery

ansible/
├── ansible.cfg
├── inventory.yml
└── playbooks/
    ├── deploy.yml       # Full deploy: sync + bootstrap + services
    ├── sync.yml         # Sync files only
    ├── restart.yml      # Pull images + restart
    └── status.yml       # Health check
```

**4 IAM identities** with isolated permissions:

| Identity | Purpose | Permissions | Where credentials live |
|----------|---------|-------------|----------------------|
| `scanorbit-admin` | Layer 1 management | AllProductsFullAccess (project) + IAM (org) | Password manager only |
| `scanorbit-deploy` | Layer 2 daily ops | InstancesFullAccess, VPCFullAccess, ObjectStorageRead (project) + ProjectReadOnly (org) | Scaleway CLI profile + `~/.zshrc` |
| `scanorbit-backup-writer` | Server cron backups | ObjectStorageObjectsWrite (project) | Docker secrets on server |
| `scanorbit-backup-reader` | Restore operations | ObjectStorageObjectsRead, ObjectStorageBucketsRead (project) | Password manager |

---

## Prerequisites

- Scaleway account with an organization and a project
- Terraform >= 1.0
- Ansible (`pip install ansible`)
- Domain registered in Scaleway Domains (e.g., `scanorbit.cloud`)
- SSH key pair for server access
- GitHub PAT for self-hosted runners (Fine-grained token with Administration read/write on target repos)

**Gather these before starting:**

| Item | Where to find |
|------|--------------|
| Organization ID | Scaleway Console -> Organization -> Settings (UUID) |
| Project ID | Scaleway Console -> Project Settings (UUID) |
| Domain name | Your registered domain |
| SSH public key | `cat ~/.ssh/id_ed25519.pub` |

---

## Step 1: Create Admin IAM Application (Console)

The admin identity is created manually — it manages everything else including the state bucket.

1. Go to **Scaleway Console -> IAM -> Applications**
2. Click **Create Application**, name it `scanorbit-admin`
3. Go to **IAM -> Policies -> Create Policy**
4. **Scope:** select your project (e.g., `ScanOrbit`)
5. Add **Rule #1** with permission set:
   - Under **AllProducts**: select `AllProductsFullAccess`
6. If IAM operations fail later (creating deploy/backup-writer apps), you need organization-level IAM access:
   - Add **Rule #2** with **Organization** scope
   - Select IAM-related permission sets (or ask your org admin to grant them)
7. Click **Validate** and attach the policy to `scanorbit-admin`
8. Go to **IAM -> API Keys -> Create API Key**
9. Select `scanorbit-admin` as the application
10. **Save both keys in your password manager** — the secret key is shown only once

---

## Step 2: Bootstrap — Create State Bucket

Creates the S3 bucket for Terraform remote state. Uses local state file.

```bash
# Export admin credentials from password manager
export SCW_ACCESS_KEY=<admin-access-key>
export SCW_SECRET_KEY=<admin-secret-key>

cd terraform/bootstrap
terraform init
terraform apply
```

**Important:** Back up `terraform/bootstrap/terraform.tfstate` to your password manager. This file is the only way to manage the state bucket via Terraform.

---

## Step 3: Layer 1 — Backup Bucket, IAM, DNS

Creates:
- Backup S3 bucket with Object Lock (7-day GOVERNANCE retention)
- Deploy, backup-writer, and backup-reader IAM identities with policies and API keys
- DNS records for all subdomains (root, www, app, api, ci)

```bash
# Admin credentials (provider reads SCW_*, S3 backend reads AWS_*)
export SCW_ACCESS_KEY=<admin-access-key>
export SCW_SECRET_KEY=<admin-secret-key>
export AWS_ACCESS_KEY_ID=$SCW_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SCW_SECRET_KEY

cd terraform/layer1-backup
terraform init
terraform apply \
  -var organization_id=<your-org-uuid> \
  -var project_id=<your-project-uuid> \
  -var domain=scanorbit.cloud \
  -var app_server_ip=1.2.3.4 \
  -var ci_server_ip=1.2.3.4
```

> **First-time setup:** Use placeholder IPs `1.2.3.4`. You'll update them in Step 6 after Layer 2 creates servers.

> **Why two env var sets?** The Scaleway Terraform provider reads `SCW_ACCESS_KEY`/`SCW_SECRET_KEY`. The S3 backend (for remote state) reads `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. Both must be set.

### Save credentials

```bash
terraform output -raw deploy_access_key
terraform output -raw deploy_secret_key
terraform output -raw backup_writer_access_key
terraform output -raw backup_writer_secret_key
terraform output -raw backup_reader_access_key
terraform output -raw backup_reader_secret_key
```

| Output | Where to store |
|--------|---------------|
| `deploy_access_key` + `deploy_secret_key` | Scaleway CLI profile + `~/.zshrc` (see Step 4) |
| `backup_writer_access_key` + `backup_writer_secret_key` | Password manager, then Docker secrets on server (`scw_access_key`, `scw_secret_key`) |
| `backup_reader_access_key` + `backup_reader_secret_key` | Password manager (used only during restore) |

---

## Step 4: Configure Deploy Credentials

### 4a. Scaleway CLI profile

Edit `~/.config/scw/config.yaml`:

```yaml
profiles:
  scanorbit:
    access_key: <deploy_access_key>
    secret_key: <deploy_secret_key>
    default_organization_id: <your-org-uuid>
    default_project_id: <your-project-uuid>
    default_region: nl-ams
    default_zone: nl-ams-1
```

> If you have multiple projects, add a profile for each. Do NOT set `active_profile` — control it via the `use-scw` function below.

### 4b. Shell function for switching profiles

Add to `~/.zshrc`:

```bash
# Switch Scaleway profile — sets SCW + AWS env vars for both scw CLI and Terraform
use-scw() {
  export SCW_PROFILE="$1"
  export SCW_ACCESS_KEY=$(scw config get access-key)
  export SCW_SECRET_KEY=$(scw config get secret-key)
  export AWS_ACCESS_KEY_ID="$SCW_ACCESS_KEY"
  export AWS_SECRET_ACCESS_KEY="$SCW_SECRET_KEY"
  echo "Switched to Scaleway profile: $1"
}

# Default profile on shell start
use-scw scanorbit
```

```bash
source ~/.zshrc
```

### 4c. Verify

```bash
# Should list state bucket contents
aws --endpoint-url https://s3.nl-ams.scw.cloud s3 ls s3://scanorbit-terraform-state/
```

---

## Step 5: Layer 2 — Application Servers

Creates app server, CI runner / jump host, private network, security groups, and public IPs.

### 5a. Create GitHub PAT for runners

1. Go to **GitHub -> Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens**
2. **Token name:** `scanorbit-runners`
3. **Expiration:** 90 days
4. **Repository access:** Only select repositories -> pick your repos
5. **Permissions:** Administration: Read and write
6. Generate and copy the token

### 5b. Apply Layer 2

```bash
cd terraform/layer2-server
terraform init
terraform apply \
  -var project_id=<your-project-uuid> \
  -var domain=scanorbit.cloud \
  -var admin_email=your@email.com \
  -var github_runner_token=<github-pat> \
  -var 'ssh_public_keys=["ssh-ed25519 AAAA... you@machine"]'
```

### 5c. Save outputs

```bash
terraform output public_ip        # App server public IP
terraform output ci_public_ip     # CI / jump host public IP
terraform output app_private_ip   # App server private IP (for SSH via jump host)
```

---

## Step 6: Update DNS with Real IPs

Replace placeholder IPs in Layer 1 DNS records with real IPs from Layer 2.

```bash
# Switch to admin credentials temporarily
export SCW_ACCESS_KEY=<admin-key-from-password-manager>
export SCW_SECRET_KEY=<admin-secret-key>
export AWS_ACCESS_KEY_ID=$SCW_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SCW_SECRET_KEY

cd terraform/layer1-backup
terraform apply \
  -var organization_id=<your-org-uuid> \
  -var project_id=<your-project-uuid> \
  -var domain=scanorbit.cloud \
  -var app_server_ip=<real-app-ip> \
  -var ci_server_ip=<real-ci-ip>

# Restore deploy credentials
use-scw scanorbit
```

---

## Step 7: Verify SSH Access

Wait 2-3 minutes for cloud-init to finish, then verify:

```bash
# Connect to CI / jump host
ssh deploy@ci.scanorbit.cloud

# If you get "REMOTE HOST IDENTIFICATION HAS CHANGED" (after server rebuild):
ssh-keygen -R ci.scanorbit.cloud
ssh deploy@ci.scanorbit.cloud

# From CI, connect to app server via private network
ssh deploy@<app-private-ip>

# Or directly from your machine via jump host
ssh -J deploy@ci.scanorbit.cloud deploy@<app-private-ip>

# Check cloud-init status on both VMs
cloud-init status
```

---

## Step 8: Deploy Application (Ansible)

### 8a. First-time setup (with secrets)

Prepare `secrets.env` from the template:

```bash
cp deploy/secrets.env.example secrets.env
# Edit secrets.env — fill in all values
# Include backup-writer keys from Layer 1 output as scw_access_key / scw_secret_key
```

Deploy everything:

```bash
cd ansible
ansible-playbook playbooks/deploy.yml -e secrets_file=../secrets.env
```

This will:
1. Rsync deploy files to the server
2. Copy and process secrets
3. Generate TLS certificates
4. Set file permissions
5. Start PostgreSQL + Redis
6. Wait for database
7. Start all services
8. Verify health

**Delete secrets.env after deploy:** `rm -f secrets.env`

### 8b. Quick operations

```bash
# Sync files only (no restart)
make deploy-sync

# Restart services (pull latest images)
make deploy-restart

# Check status
make deploy-status

# Full redeploy
make deploy
```

### 8c. GHCR authentication (for pulling Docker images)

On the server, run bootstrap with GitHub auth:

```bash
ssh -J deploy@ci.scanorbit.cloud deploy@<app-private-ip>
cd /opt/scanorbit
sudo ./scripts/bootstrap.sh --github
# Enter your GitHub username and a PAT with read:packages scope
```

---

## Step 9: Restore Database (if rebuilding)

If restoring from a previous backup:

```bash
ssh -J deploy@ci.scanorbit.cloud deploy@<app-private-ip>
cd /opt/scanorbit

# List available backups (uses backup-reader credentials)
docker compose --profile restore run --rm db-restore --list

# Restore specific backup
docker compose --profile restore run --rm db-restore db/daily/scanorbit_20260327_020000.sql.gz.gpg

# Restart all services
docker compose up -d
```

> **Note:** The restore profile uses backup-reader credentials which have read-only access to the backup bucket.

---

## Step 10: Verify Everything

```bash
# From your machine
curl -sf https://api.scanorbit.cloud/health
curl -sf https://app.scanorbit.cloud
curl -sf https://scanorbit.cloud

# Or via Ansible
make deploy-status

# SSH tunnels for monitoring dashboards
make tunnel-grafana      # Grafana at localhost:3001
make tunnel-prometheus   # Prometheus at localhost:9092
make tunnel-umami        # Umami at localhost:3002
```

---

## Backup Strategy

Three types of encrypted backups to S3, all using the backup-writer identity:

| Backup | Frequency | S3 Path | Retention | Encryption Key |
|--------|-----------|---------|-----------|---------------|
| PostgreSQL dump | Daily (cron) | `db/{daily,weekly,monthly}/` | 30d / 90d / 365d | `backup_encryption_key` |
| Docker secrets | On-demand | `secrets/` | 365d | `secrets_master_key` |
| Monitoring configs | On-demand | `configs/` | 90d | `backup_encryption_key` |

**Object Lock:** 7-day GOVERNANCE mode prevents deletion of recent backups even if server or backup-writer credentials are compromised.

### Run backups manually

```bash
# On the server
docker compose exec postgres-backup /usr/local/bin/backup.sh                # DB backup
docker compose --profile backup-extras run --rm secrets-backup              # Secrets backup
docker compose --profile backup-extras run --rm configs-backup              # Configs backup
```

---

## Disaster Recovery

Use `terraform/scripts/restore.sh` for semi-automated recovery after Layer 2 destruction.

```bash
cd terraform/scripts
bash restore.sh
```

The script walks through 10 steps:
1. Provision Layer 2 infrastructure (`terraform apply`)
2. Wait for cloud-init + SSH
3. Update DNS with new IPs (manual — requires admin credentials)
4. Deploy application files via rsync
5. Restore secrets (from password manager or S3 backup)
6. Generate internal TLS certificates
7. Start PostgreSQL + Redis
8. Restore database from S3 backup
9. Start all services
10. Verify health endpoints

**Estimated recovery time:** 15-30 minutes.

---

## Credential Switching

### Daily work

```bash
# Deploy credentials are loaded automatically via use-scw in ~/.zshrc
cd terraform/layer2-server
terraform plan
```

### Layer 1 operations (admin — from password manager)

```bash
export SCW_ACCESS_KEY=<admin-key>
export SCW_SECRET_KEY=<admin-secret>
export AWS_ACCESS_KEY_ID=$SCW_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SCW_SECRET_KEY

cd terraform/layer1-backup
terraform apply \
  -var organization_id=<org-uuid> \
  -var project_id=<project-uuid> \
  -var domain=scanorbit.cloud \
  -var app_server_ip=<app-ip> \
  -var ci_server_ip=<ci-ip>

# Restore deploy credentials
use-scw scanorbit
```

### Multiple Scaleway projects

Add profiles to `~/.config/scw/config.yaml`:

```yaml
profiles:
  scanorbit:
    access_key: ...
    secret_key: ...
    default_project_id: <scanorbit-project-id>
    default_region: nl-ams
    default_zone: nl-ams-1

  biomaxing:
    access_key: ...
    secret_key: ...
    default_project_id: <biomaxing-project-id>
    default_region: ...
    default_zone: ...
```

Switch with `use-scw scanorbit` or `use-scw biomaxing`.

---

## Threat Matrix

| Threat | Protected? | How |
|--------|-----------|-----|
| Accidental `terraform destroy` | Yes | Layer 2 destroy cannot reach backups, DNS, or IAM |
| Compromised laptop | Yes | Deploy credentials have no write/delete access to backup bucket |
| Compromised server | Partially | Backup-writer can only upload (PutObject), Object Lock prevents deletion for 7 days |
| Scaleway account compromise | No | Both layers in same account — Object Lock is last resort |
| Operator error (delete bucket) | Partially | `prevent_destroy = true` in Terraform, Object Lock adds friction |

---

## File Reference

### Bootstrap (`terraform/bootstrap/`)

| File | Purpose |
|------|---------|
| `main.tf` | State bucket with versioning, `prevent_destroy = true` |
| `variables.tf` | Region, project_name, environment |
| `outputs.tf` | Bucket name, endpoint, region |

### Layer 1 (`terraform/layer1-backup/`)

| File | Purpose |
|------|---------|
| `main.tf` | Provider config (admin credentials via env vars, organization_id + project_id) |
| `backend.tf` | Remote state in bootstrap bucket (`endpoints.s3` syntax) |
| `variables.tf` | Organization ID, project ID, domain, server IPs (with IPv4 validation) |
| `object-storage.tf` | Backup bucket, Object Lock, lifecycle rules, `prevent_destroy = true` |
| `iam.tf` | Deploy, backup-writer, backup-reader identities + policies (all keys have `default_project_id`) |
| `dns.tf` | A/CNAME records for root, www, app, api, ci |
| `outputs.tf` | All credential outputs (marked `sensitive = true`) |

### Layer 2 (`terraform/layer2-server/`)

| File | Purpose |
|------|---------|
| `main.tf` | Provider config (deploy credentials via env vars, project_id) |
| `backend.tf` | Remote state in bootstrap bucket |
| `variables.tf` | Project ID, instance config, GitHub runner config |
| `instance.tf` | App server VM with cloud-init |
| `ci-instance.tf` | CI runner / jump host VM (`ignore_changes = [user_data]`) |
| `network.tf` | Private network (10.10.0.0/24) |
| `security_group.tf` | App server firewall (HTTP/HTTPS only, no public SSH) |
| `ci-security-group.tf` | CI runner firewall (SSH + HTTPS) |
| `outputs.tf` | Server IPs |

### Scripts

| File | Purpose |
|------|---------|
| `terraform/scripts/restore.sh` | Semi-automated 10-step disaster recovery |
| `deploy/scripts/backup.sh` | PostgreSQL dump to temp file, compress, encrypt, upload |
| `deploy/scripts/backup-secrets.sh` | Docker secrets backup (excludes S3 creds) |
| `deploy/scripts/backup-configs.sh` | Monitoring config backup |
| `deploy/scripts/bootstrap.sh` | One-time server setup (secrets, TLS, GHCR, permissions) |
| `deploy/scripts/deploy.sh` | Service deployment (pull + migrate + restart) |

### Ansible (`ansible/`)

| File | Purpose |
|------|---------|
| `ansible.cfg` | Config with SSH pipelining |
| `inventory.yml` | CI jump host + app server with ProxyJump |
| `playbooks/deploy.yml` | Full deploy: sync + bootstrap + services + verify |
| `playbooks/sync.yml` | Quick file sync only |
| `playbooks/restart.yml` | Pull images + restart services |
| `playbooks/status.yml` | Health check all services |

### Makefile targets

| Target | What it does |
|--------|-------------|
| `make deploy` | Full Ansible deploy |
| `make deploy-sync` | Sync deploy files |
| `make deploy-restart` | Pull + restart services |
| `make deploy-status` | Check service health |
| `make deploy-bootstrap` | Run bootstrap only |
| `make deploy-services` | Start services only |
| `make tunnel-grafana` | SSH tunnel to Grafana (localhost:3001) |
| `make tunnel-prometheus` | SSH tunnel to Prometheus (localhost:9092) |
| `make tunnel-umami` | SSH tunnel to Umami (localhost:3002) |

---

## Troubleshooting

### `terraform init` returns 403 on state bucket

The S3 backend uses `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, not `SCW_*` env vars. Ensure both are set:

```bash
export AWS_ACCESS_KEY_ID=$SCW_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SCW_SECRET_KEY
```

### "REMOTE HOST IDENTIFICATION HAS CHANGED" on SSH

Expected after server rebuild. Remove the old host key:

```bash
ssh-keygen -R ci.scanorbit.cloud
```

### Deploy identity can't access S3

Ensure the API key has `default_project_id` set to the correct project. API keys without a default project can't access project-scoped resources. Recreate via Layer 1 `terraform apply` if needed.

### "Multiple variable sources detected" warning

The Scaleway provider detects credentials from both the CLI config profile and environment variables. This is harmless — env vars take precedence. To silence it, ensure your `~/.config/scw/config.yaml` doesn't set an `active_profile`.

### Permission set errors ("not found" or "must be same scope type")

Scaleway permission sets are either project-scoped or organization-scoped. They cannot be mixed in the same rule. Use separate rules:

```hcl
rule {
  project_ids          = [var.project_id]
  permission_set_names = ["InstancesFullAccess"]  # project-scoped
}
rule {
  organization_id      = var.organization_id
  permission_set_names = ["ProjectReadOnly"]  # org-scoped
}
```
