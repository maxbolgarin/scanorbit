# Terraform Two-Layer Architecture

Backup isolation for ScanOrbit infrastructure on Scaleway. A single `terraform destroy` on Layer 2 cannot touch backups, DNS, or IAM identities.

## Architecture Overview

```
terraform/
├── bootstrap/           # State bucket (run once, local state)
├── layer1-backup/       # Backup bucket, IAM, DNS (admin-only)
├── layer2-server/       # Instances, networking (daily deploy credentials)
└── scripts/restore.sh   # Semi-automated disaster recovery
```

**4 IAM identities** with isolated permissions:

| Identity | Purpose | Permissions | Where credentials live |
|----------|---------|-------------|----------------------|
| `scanorbit-admin` | Layer 1 management | ObjectStorageFullAccess, DomainsDNSFullAccess | Password manager only |
| `scanorbit-deploy` | Layer 2 daily ops | Instances, VPC, IPs, SecurityGroups, ObjectStorageRead (state bucket only) | Shell profile (`~/.zshrc`) |
| `scanorbit-backup-writer` | Server cron backups | ObjectStorageObjectsWrite + bucket policy PutObject only | Docker secrets on server |
| `scanorbit-backup-reader` | Restore operations | ObjectStorageObjectsRead, ObjectStorageBucketsRead | Password manager |

---

## Step-by-Step Setup

### Prerequisites

- Scaleway account with a project named "default"
- Terraform >= 1.0 installed
- Domain registered in Scaleway Domains (e.g., `scanorbit.cloud`)
- SSH key pair for server access

---

### Step 1: Create the Admin IAM Application (Console)

The admin identity is created manually because it manages everything else, including the Terraform state bucket.

1. Go to **Scaleway Console** -> **IAM** -> **Applications**
2. Click **Create Application**, name it `scanorbit-admin`
3. Go to **IAM** -> **Policies** -> **Create Policy**
4. Set scope to your project (e.g., `ScanOrbit`)
5. Add **Rule #1** with these permission sets:
   - Under **Storage**: select `ObjectStorageFullAccess`
   - Under **Domains & Web Hosting**: select `DomainsDNSFullAccess`

   > **Note:** There is no `IAMManager` permission set in the Scaleway console.
   > Scaleway IAM management works at the Organization level. The Terraform provider
   > uses the API key directly for IAM operations. If Layer 1 `terraform apply` fails
   > on IAM resources, use `AllProductsFullAccess` under **AllProducts** instead.

6. Click **Validate** and attach the policy to the `scanorbit-admin` application
7. Go to **IAM** -> **API Keys** -> **Create API Key**
8. Select `scanorbit-admin` as the application
9. **Save both keys in your password manager immediately** — you won't see the secret key again

---

### Step 2: Bootstrap — Create State Bucket

The bootstrap layer creates the S3 bucket for Terraform remote state. It uses local state (back up `terraform.tfstate` to your password manager).

```bash
# Export admin credentials from password manager
export SCW_ACCESS_KEY=<admin-access-key>
export SCW_SECRET_KEY=<admin-secret-key>

cd terraform/bootstrap
terraform init
terraform apply
```

Outputs:
- `state_bucket_name` — used in `backend.tf` of both layers
- `state_bucket_endpoint` — S3 endpoint

**Back up `terraform/bootstrap/terraform.tfstate` to your password manager.**

---

### Step 3: Layer 1 — Backup Bucket, IAM, DNS

Layer 1 creates:
- Backup S3 bucket with Object Lock (7-day GOVERNANCE retention)
- Deploy, backup-writer, and backup-reader IAM identities with policies
- Bucket policy: deny deploy identity, allow backup-writer PutObject only
- DNS records for all subdomains

```bash
# Admin credentials from password manager (provider reads SCW_*, backend reads AWS_*)
export SCW_ACCESS_KEY=<from-password-manager>
export SCW_SECRET_KEY=<from-password-manager>
export AWS_ACCESS_KEY_ID=$SCW_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SCW_SECRET_KEY

cd terraform/layer1-backup
terraform init
terraform apply \
    -var organization_id=<your-scaleway-organization-id> \
    -var project_id=<your-scaleway-project-id> \
    -var domain=scanorbit.cloud \
    -var app_server_ip=1.2.3.4 \
    -var ci_server_ip=1.2.3.4
```

> Get your project ID from **Scaleway Console -> Project Settings**.

> **First-time setup:** Use placeholder IPs like `1.2.3.4`. You'll update them after Layer 2 creates the servers.

**Save these outputs to your password manager:**

```bash
# View sensitive outputs
terraform output -raw deploy_access_key
terraform output -raw deploy_secret_key
terraform output -raw backup_writer_access_key
terraform output -raw backup_writer_secret_key
terraform output -raw backup_reader_access_key
terraform output -raw backup_reader_secret_key
```

| Output | Where to store |
|--------|---------------|
| `deploy_access_key` + `deploy_secret_key` | Your `~/.zshrc` as `SCW_ACCESS_KEY` / `SCW_SECRET_KEY` + `AWS_*` |
| `backup_writer_access_key` + `backup_writer_secret_key` | Server Docker secrets: `scw_access_key`, `scw_secret_key` |
| `backup_reader_access_key` + `backup_reader_secret_key` | Password manager (used only during restore) |

---

### Step 4: Configure Deploy Credentials

Add to your `~/.zshrc` (or `~/.bashrc`):

```bash
# ScanOrbit deploy credentials (restricted — cannot touch backups)
# Used by both Scaleway provider (SCW_*) and S3 backend (AWS_*)
export SCW_ACCESS_KEY="SCWXXXXXXXXXXXXXXXXX"
export SCW_SECRET_KEY="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export AWS_ACCESS_KEY_ID="$SCW_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$SCW_SECRET_KEY"
```

```bash
source ~/.zshrc
```

---

### Step 5: Layer 2 — Application Server

Layer 2 creates instances, networking, and security groups using deploy credentials.

```bash
# Deploy credentials already set in ~/.zshrc (SCW_* + AWS_*)
cd terraform/layer2-server
terraform init
terraform apply \
  -var domain=scanorbit.cloud \
  -var admin_email=your@email.com \
  -var github_runner_token=<github-pat> \
  -var 'ssh_public_keys=["ssh-ed25519 AAAA... you@machine"]'
```

Outputs:
- `public_ip` — app server public IP
- `ci_public_ip` — CI runner / jump host IP
- `app_private_ip` — app server private IP (SSH via jump host)

---

### Step 6: Update DNS with Real IPs

After Layer 2 creates servers, update Layer 1 DNS records:

```bash
# Get new IPs
cd terraform/layer2-server
terraform output public_ip
terraform output ci_public_ip

# Switch to admin credentials
export SCW_ACCESS_KEY=<from-password-manager>
export SCW_SECRET_KEY=<from-password-manager>
export AWS_ACCESS_KEY_ID=$SCW_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SCW_SECRET_KEY

cd terraform/layer1-backup
terraform apply \
  -var organization_id=<your-scaleway-organization-id> \
  -var project_id=<your-scaleway-project-id> \
  -var domain=scanorbit.cloud \
  -var app_server_ip=51.15.90.101 \
  -var ci_server_ip=51.15.66.0

# Restore deploy credentials
exec zsh
```

---

### Step 7: Deploy Application & Configure Secrets

SSH to the app server and set up Docker secrets:

```bash
# SSH via jump host
ssh -J deploy@<ci-public-ip> deploy@<app-private-ip>

# On the server: create Docker secrets
cd /opt/scanorbit
./scripts/setup-secrets.sh
```

Required Docker secrets on the server:
- `postgres_password` — PostgreSQL password
- `backup_encryption_key` — GPG key for DB backup encryption
- `secrets_master_key` — GPG key for secrets backup encryption (separate from DB key)
- `scw_access_key` — backup-writer access key (from Layer 1 output)
- `scw_secret_key` — backup-writer secret key (from Layer 1 output)
- Other application secrets (Stripe, OAuth, etc.)

---

## Backup Strategy

Three types of encrypted backups to S3, all using the backup-writer identity (PutObject only):

| Backup | Frequency | S3 Path | Retention | Encryption Key |
|--------|-----------|---------|-----------|---------------|
| PostgreSQL dump | Daily (cron) | `db/{daily,weekly,monthly}/` | 30d / 90d / 365d | `backup_encryption_key` |
| Docker secrets | On-demand | `secrets/` | 365d | `secrets_master_key` |
| Monitoring configs | On-demand | `configs/` | 90d | `backup_encryption_key` |

**Object Lock:** 7-day GOVERNANCE mode prevents deletion of recent backups, even if the server or backup-writer credentials are compromised.

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

### Quick Summary

1. `terraform apply` in `layer2-server/` (creates new servers)
2. Update DNS in `layer1-backup/` with new IPs (requires admin credentials)
3. Deploy application files via rsync
4. Restore secrets from password manager or S3 backup
5. Generate internal TLS certificates
6. Start PostgreSQL + Redis
7. Restore database from S3 backup (requires backup-reader credentials)
8. Start all services
9. Verify health endpoints

### Run the restore script

```bash
# Ensure deploy credentials are set
cd terraform/scripts
bash restore.sh
```

> **Note:** The restore script will prompt for manual steps (DNS update, secrets placement, backup selection).

---

## Credential Switching

### Daily work (deploy credentials in ~/.zshrc)

```bash
# SCW_* and AWS_* are set in ~/.zshrc to deploy credentials
cd terraform/layer2-server
terraform plan
```

### Layer 1 operations (admin credentials from password manager)

```bash
# Temporarily override with admin credentials
export SCW_ACCESS_KEY=<from-password-manager>
export SCW_SECRET_KEY=<from-password-manager>
export AWS_ACCESS_KEY_ID=$SCW_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SCW_SECRET_KEY

cd terraform/layer1-backup
terraform plan

# When done — restart your shell to restore deploy credentials:
exec zsh
```

---

## Threat Matrix

| Threat | Protected? | How |
|--------|-----------|-----|
| Accidental `terraform destroy` | Yes | Layer 2 destroy cannot reach backups, DNS, or IAM |
| Compromised laptop | Yes | Deploy credentials have explicit Deny on backup bucket |
| Compromised server | Partially | Backup-writer can only PutObject, Object Lock prevents deletion for 7 days |
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
| `main.tf` | Provider config (admin credentials) |
| `backend.tf` | Remote state in bootstrap bucket |
| `variables.tf` | Admin creds, domain, server IPs (with IPv4 validation) |
| `object-storage.tf` | Backup bucket, Object Lock, lifecycle rules, `prevent_destroy = true` |
| `iam.tf` | Deploy, backup-writer, backup-reader identities + policies + bucket policy |
| `dns.tf` | A/CNAME records for all subdomains |
| `outputs.tf` | All credential outputs (sensitive) |

### Layer 2 (`terraform/layer2-server/`)

| File | Purpose |
|------|---------|
| `main.tf` | Provider config (deploy credentials) |
| `backend.tf` | Remote state in bootstrap bucket |
| `variables.tf` | Deploy creds, instance config, GitHub runner config |
| `instance.tf` | App server VM with cloud-init |
| `ci-instance.tf` | CI runner / jump host VM |
| `network.tf` | Private network |
| `security_group.tf` | App server firewall rules |
| `ci-security-group.tf` | CI runner firewall rules |
| `outputs.tf` | Server IPs |

### Scripts

| File | Purpose |
|------|---------|
| `terraform/scripts/restore.sh` | Semi-automated 10-step disaster recovery |
| `deploy/scripts/backup.sh` | PostgreSQL dump, compress, encrypt, upload |
| `deploy/scripts/backup-secrets.sh` | Docker secrets backup (excludes S3 creds) |
| `deploy/scripts/backup-configs.sh` | Monitoring config backup |
