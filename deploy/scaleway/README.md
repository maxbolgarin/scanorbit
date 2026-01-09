# ScanOrbit Scaleway Infrastructure

Terraform configuration for deploying ScanOrbit on Scaleway Cloud.

## Architecture

```
┌─────────────────────────────────────────┐
│           Scaleway Cloud (EU)           │
└─────────────────────────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼────┐   ┌─────▼─────┐   ┌────▼────┐
│   DNS   │   │ Reserved  │   │ Security│
│ Records │   │    IP     │   │  Group  │
└────┬────┘   └─────┬─────┘   └────┬────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
           ┌────────▼────────┐
           │   DEV1-M VM     │
           │  (Docker Host)  │
           └────────┬────────┘
                    │
        ┌───────────┴───────────┐
        │    Docker Compose     │
        │  ┌─────────────────┐  │
        │  │ Caddy (80/443)  │──┼──► HTTPS + Let's Encrypt
        │  └────────┬────────┘  │
        │           │           │
        │  ┌────────▼────────┐  │
        │  │ API (Node.js)   │  │
        │  │ App (React)     │  │
        │  │ Landing (Astro) │  │
        │  │ Workers (Go)    │  │
        │  │ PostgreSQL      │  │
        │  │ Redis           │  │
        │  └─────────────────┘  │
        └───────────────────────┘
```

## Prerequisites

1. **Scaleway Account** with API credentials
2. **Domain** registered or transferred to Scaleway Domains
3. **SSH Key** registered in Scaleway IAM
4. **Scaleway CLI** (`scw`) installed

### Installing Scaleway CLI

#### macOS (Homebrew)
```bash
brew install scaleway/tap/scw
```

#### Linux
```bash
# Download and install
curl -o /usr/local/bin/scw -L "https://github.com/scaleway/scaleway-cli/releases/latest/download/scw-linux-x86_64"
chmod +x /usr/local/bin/scw
```

#### Windows
```powershell
# Using Scoop
scoop bucket add scaleway https://github.com/scaleway/scoop-bucket.git
scoop install scaleway-cli

# Or download from: https://github.com/scaleway/scaleway-cli/releases
```

#### Verify Installation
```bash
scw version
```

### Setting up Scaleway Credentials

```bash
# Option 1: Environment variables
export SCW_ACCESS_KEY="your-access-key"
export SCW_SECRET_KEY="your-secret-key"
export SCW_DEFAULT_PROJECT_ID="your-project-id"

# Option 2: Scaleway CLI config (~/.config/scw/config.yaml)
scw init
```

### Getting SSH Key ID

```bash
# List your SSH keys
scw iam ssh-key list

# Or find at: https://console.scaleway.com/iam/ssh-keys
```

## Usage

### 1. Configure Variables

```bash
cd terraform/scaleway

# Copy example config
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan Changes

```bash
terraform plan
```

### 4. Apply Infrastructure

```bash
terraform apply
```

### 5. Deploy Application

After Terraform creates the infrastructure:

```bash
# Get the public IP
terraform output public_ip

# SSH into the server
ssh root@$(terraform output -raw public_ip)
```

#### Step 1: View the GitHub Deploy Key

The VM automatically generates an SSH key for GitHub. View it:

```bash
/opt/setup-ssh.sh
```

This will display output like:

```
==========================================
  GitHub Deploy Key Setup Instructions
==========================================

1. Copy this public key:

ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... scanorbit-vm

2. Add it to your GitHub repository:
   - Go to: https://github.com/YOUR_ORG/scanorbit/settings/keys
   - Click 'Add deploy key'
   - Title: 'ScanOrbit Production Server'
   - Paste the key above
   - Check 'Allow write access' if needed
   - Click 'Add key'
```

#### Step 2: Add Deploy Key to GitHub

1. Go to your repository: `https://github.com/YOUR_ORG/scanorbit/settings/keys`
2. Click **"Add deploy key"**
3. Fill in the form:
   - **Title**: `ScanOrbit Production Server`
   - **Key**: Paste the public key from the VM
   - **Allow write access**: Check if you need push capability
4. Click **"Add key"**

#### Step 3: Test GitHub Connection

```bash
ssh -T git@github.com
# Expected: "Hi YOUR_ORG/scanorbit! You've successfully authenticated..."
```

#### Step 4: Clone the Repository

```bash
# Using the clone script (recommended)
GITHUB_REPO=git@github.com:YOUR_ORG/scanorbit.git /opt/clone-repo.sh

# Or manually
cd /opt/scanorbit
git clone git@github.com:YOUR_ORG/scanorbit.git .
```

#### Step 5: Configure and Start

```bash
cd /opt/scanorbit

# Configure environment
cp .env.example .env.prod
vim .env.prod  # Add your secrets

# Start services
docker compose -f docker-compose.prod.yml up -d
```

## Resources Created

| Resource | Type | Description |
|----------|------|-------------|
| `scaleway_instance_ip` | Reserved IP | Static public IPv4 |
| `scaleway_instance_security_group` | Firewall | Allow SSH, HTTP, HTTPS |
| `scaleway_instance_server` | DEV1-M VM | Docker host |
| `scaleway_domain_record` | DNS A | Root domain |
| `scaleway_domain_record` | DNS CNAME | www subdomain |
| `scaleway_domain_record` | DNS A | app subdomain |
| `scaleway_domain_record` | DNS A | api subdomain |

## DNS Records

| Record | Type | Value |
|--------|------|-------|
| `scanorbit.io` | A | VM Public IP |
| `www.scanorbit.io` | CNAME | scanorbit.io |
| `app.scanorbit.io` | A | VM Public IP |
| `api.scanorbit.io` | A | VM Public IP |

## Instance Types

| Type | vCPU | RAM | Storage | Price |
|------|------|-----|---------|-------|
| DEV1-S | 2 | 2GB | 20GB | ~€4/mo |
| **DEV1-M** | 3 | 4GB | 40GB | ~€7/mo |
| DEV1-L | 4 | 8GB | 80GB | ~€14/mo |
| GP1-XS | 4 | 16GB | 150GB | ~€20/mo |

## Outputs

```bash
# View all outputs
terraform output

# Get specific values
terraform output public_ip
terraform output ssh_command
terraform output domain_url
```

## Maintenance

### SSH Access

```bash
ssh root@$(terraform output -raw public_ip)
```

### View Logs

```bash
# On the server
cd /opt/scanorbit
docker compose -f docker-compose.prod.yml logs -f
```

### Update Application

```bash
# On the server - using the clone script (handles pull if repo exists)
/opt/clone-repo.sh

# Or manually
cd /opt/scanorbit
git pull
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Destroy Infrastructure

```bash
terraform destroy
```

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| DEV1-M Instance | ~€7 |
| Reserved IP | ~€3 |
| DNS | Free |
| **Total** | **~€10/month** |

## Troubleshooting

### Terraform warning about multiple variable sources

If you see a warning like:
```
Warning: Multiple variable sources detected...
Variable              AvailableSources                                                        Using
SCW_DEFAULT_REGION    Active Profile in config.yaml, Profile defined in provider{} block      Profile defined in provider{} block
SCW_DEFAULT_ZONE      Active Profile in config.yaml, Profile defined in provider{} block      Profile defined in provider{} block
```

This is **harmless** - Terraform is correctly using the values from the provider block in `versions.tf`, which takes precedence over your Scaleway CLI config file. The provider block explicitly sets `zone` and `region` from Terraform variables, making the configuration explicit and reproducible.

**To resolve the warning** (optional):
- The warning can be safely ignored, OR
- Remove the `zone` and `region` from your Scaleway CLI config if you want to rely solely on Terraform variables:
  ```bash
  # Edit ~/.config/scw/config.yaml and remove default_zone and default_region
  # Or use environment variables instead
  export SCW_DEFAULT_REGION=""
  export SCW_DEFAULT_ZONE=""
  ```

### DNS not resolving

DNS propagation can take up to 48 hours. Check with:

```bash
dig scanorbit.io
nslookup scanorbit.io
```

### SSL certificate not issued

Ensure ports 80 and 443 are accessible:

```bash
# On the server
sudo ufw status
curl -I http://scanorbit.io
```

### Docker not starting

```bash
# Check Docker status
sudo systemctl status docker

# View Docker logs
sudo journalctl -u docker
```

## Security Notes

- SSH is open to all IPs (0.0.0.0/0) - use SSH keys only
- All traffic to the VM is routed through Caddy with TLS
- PostgreSQL and Redis are not exposed externally
- Regular security updates via `apt upgrade`
