# GDPR Compliance Documentation

ScanOrbit implements comprehensive GDPR compliance measures to protect user data and ensure regulatory compliance for EU users.

## Overview

| GDPR Requirement | Implementation | Status |
|-----------------|----------------|--------|
| Data Encryption at Rest | PostgreSQL on encrypted block storage | ✅ |
| Data Encryption in Transit | TLS 1.3 (external), TLS 1.2+ (internal) | ✅ |
| Automated Backups | Daily encrypted backups to Scaleway S3 | ✅ |
| Audit Logging | Application-level audit trail | ✅ |
| Data Retention | Automated cleanup with configurable retention | ✅ |
| Right to Access (Art. 15) | Data export API endpoint | ✅ |
| Right to Erasure (Art. 17) | Account deletion with 30-day grace | ✅ |
| Right to Portability (Art. 20) | JSON data export | ✅ |
| EU Data Residency | Amsterdam (nl-ams) region | ✅ |

## Architecture

```
                    EXTERNAL (HTTPS/TLS 1.3)
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   SCALEWAY VM (nl-ams-1)                         │
│              [Encrypted Block Storage Volume]                    │
│                                                                  │
│  ┌──────────────────┐                                            │
│  │     Caddy        │◄── Let's Encrypt TLS                       │
│  └────────┬─────────┘                                            │
│           │                                                      │
│  ┌────────▼─────────┐     ┌──────────────────┐                   │
│  │   API (Node.js)  │────▶│ Audit Logs Table │                   │
│  └────────┬─────────┘     └──────────────────┘                   │
│           │                                                      │
│           │ [TLS Required]                                       │
│           ▼                                                      │
│  ┌──────────────────┐     ┌──────────────────┐                   │
│  │ PostgreSQL 17    │     │   Redis 7        │                   │
│  │ - SSL enabled    │     │ - TLS enabled    │                   │
│  │ - Query logging  │     │ - Password auth  │                   │
│  └────────┬─────────┘     └──────────────────┘                   │
│           │                                                      │
│           │ [Encrypted + Compressed]                             │
│           ▼                                                      │
│  ┌──────────────────┐                                            │
│  │ Backup Container │                                            │
│  │ - Daily pg_dump  │                                            │
│  │ - GPG encryption │                                            │
│  └────────┬─────────┘                                            │
└───────────│──────────────────────────────────────────────────────┘
            │ [HTTPS]
            ▼
┌──────────────────────────────────────────────────────────────────┐
│        Scaleway Object Storage (nl-ams)                          │
│        - Server-side encryption                                  │
│        - 30-day lifecycle retention                              │
└──────────────────────────────────────────────────────────────────┘
```

## 1. Encryption

### At Rest
- **Block Storage**: Scaleway SSD volumes with encryption
- **Backups**: AES-256 encryption via GPG before upload to S3

### In Transit
- **External**: TLS 1.3 via Caddy with Let's Encrypt certificates
- **PostgreSQL**: SSL/TLS with self-signed certificates
- **Redis**: TLS with password authentication

### Certificate Generation

Generate internal TLS certificates before first deployment:

```bash
cd deploy
./scripts/generate-certs.sh
```

This creates certificates in `deploy/certs/` for PostgreSQL and Redis.

## 2. Automated Backups

### Configuration

Backups run daily at 02:00 UTC via the `postgres-backup` container.

**Required environment variables:**
```bash
BACKUP_ENCRYPTION_KEY=<openssl rand -hex 32>
SCW_ACCESS_KEY=<scaleway_access_key>
SCW_SECRET_KEY=<scaleway_secret_key>
SCW_BUCKET_NAME=scanorbit-backups
SCW_REGION=nl-ams
```

### Backup Process

1. `pg_dump` exports PostgreSQL database
2. `gzip` compresses the dump
3. `gpg` encrypts with AES-256 using `BACKUP_ENCRYPTION_KEY`
4. Upload to Scaleway Object Storage via S3 API

### Retention Policy

| Backup Age | Action |
|------------|--------|
| 0-30 days | Keep in standard storage |
| 30-90 days | Move to Glacier class |
| 90-365 days | Keep in Glacier |
| >365 days | Auto-delete |

### Restore from Backup

```bash
# List available backups
./deploy/scripts/restore.sh --list

# Restore specific backup
./deploy/scripts/restore.sh scanorbit_backup_20240115_020000.sql.gz.gpg
```

## 3. Audit Logging

### What's Logged

All API requests are logged with:
- Timestamp
- User ID (if authenticated)
- Organization ID
- Action type (create, read, update, delete)
- Resource type and ID
- HTTP method and path
- Response status code
- Client IP address
- User agent
- Request duration (ms)

### Sensitive Operations

Additional logging for:
- Authentication events (login, logout, failed attempts)
- Data exports (GDPR Article 20 requests)
- Deletion requests (GDPR Article 17 requests)

### Audit Log Retention

- **Default**: 730 days (2 years) - GDPR minimum for investigations
- **Configurable**: `RETENTION_AUDIT_LOGS_DAYS` environment variable

### Viewing Audit Logs

Users can view their own audit logs via API:

```bash
GET /api/gdpr/audit-logs?limit=50&offset=0
```

## 4. Data Retention

### Automated Cleanup

The `retention-cleanup` container runs daily at 03:00 UTC to:

| Data Type | Default Retention | Environment Variable |
|-----------|-------------------|---------------------|
| Stale Resources | 90 days | `RETENTION_RESOURCES_DAYS` |
| Resolved Findings | 180 days | `RETENTION_FINDINGS_RESOLVED_DAYS` |
| Scan Records | 365 days | `RETENTION_SCANS_DAYS` |
| Audit Logs | 730 days | `RETENTION_AUDIT_LOGS_DAYS` |

### Manual Cleanup

Run the retention job manually:

```bash
docker compose exec retention-cleanup \
  node dist/jobs/retention-cleanup.js
```

## 5. GDPR API Endpoints

### Data Export (Article 20)

```bash
GET /api/gdpr/export
```

Returns JSON file with all user data:
- Personal information
- Organization memberships
- Consent records
- Activity logs (last 90 days)

### Request Account Deletion (Article 17)

```bash
POST /api/gdpr/delete
Content-Type: application/json

{
  "confirmEmail": "user@example.com",
  "reason": "Optional reason for deletion"
}
```

**Response:**
```json
{
  "message": "Deletion request created",
  "requestId": "uuid",
  "scheduledDeletionAt": "2024-02-15T00:00:00Z",
  "gracePeriodDays": 30,
  "note": "You can cancel this request within 30 days"
}
```

### Cancel Deletion Request

```bash
DELETE /api/gdpr/delete/:requestId
```

### Check Deletion Status

```bash
GET /api/gdpr/deletion-status
```

### View Audit Logs

```bash
GET /api/gdpr/audit-logs?limit=50&offset=0&startDate=2024-01-01T00:00:00Z
```

## 6. User Deletion Process

When a user requests account deletion:

1. **Immediate**: Request logged with 30-day grace period
2. **Grace Period**: User can cancel deletion
3. **After 30 days**: Automated processing:
   - Remove from all organizations
   - Anonymize audit logs (preserve for compliance, remove PII)
   - Delete user account
   - Mark request as completed

## 7. Consent Management

### Consent Tracking

The `consent_logs` table records:
- Consent type (terms, privacy, marketing)
- Version of policy consented to
- Whether consent was given
- Timestamp
- IP address

### Consent Types

| Type | Description |
|------|-------------|
| `terms_of_service` | Terms and conditions |
| `privacy_policy` | Privacy policy |
| `marketing_emails` | Marketing communications |
| `analytics_cookies` | Analytics tracking |

## 8. Environment Variables

### Required for GDPR Compliance

```bash
# Encryption
BACKUP_ENCRYPTION_KEY=       # openssl rand -hex 32
REDIS_PASSWORD=              # Strong password for Redis

# Scaleway S3 (for encrypted backups)
SCW_ACCESS_KEY=
SCW_SECRET_KEY=
SCW_BUCKET_NAME=scanorbit-backups
SCW_REGION=nl-ams

# Data Retention (days)
RETENTION_RESOURCES_DAYS=90
RETENTION_FINDINGS_RESOLVED_DAYS=180
RETENTION_SCANS_DAYS=365
RETENTION_AUDIT_LOGS_DAYS=730
```

## 9. Terraform Resources

The following Terraform resources support GDPR compliance:

- `scaleway_instance_volume.data` - Encrypted block storage
- `scaleway_object_bucket.backups` - S3 bucket for backups
- `scaleway_object_bucket_policy.backups` - Bucket access policy
- `scaleway_iam_application.backup` - Service account for backups
- `scaleway_iam_api_key.backup` - API key for backup operations

## 10. Monitoring & Alerts

### Backup Monitoring

Check backup status:
```bash
# View recent backup logs
docker compose logs postgres-backup --tail 100

# Verify backup exists in S3
aws s3 ls s3://scanorbit-backups/ --endpoint-url https://s3.nl-ams.scw.cloud
```

### Retention Monitoring

Check retention cleanup status:
```bash
# View retention job logs
docker compose logs retention-cleanup --tail 100

# Check pending deletions
SELECT count(*) FROM data_deletion_requests WHERE status = 'pending';
```

## 11. Incident Response

### Data Breach Procedure

1. **Identify**: Detect and assess the breach
2. **Contain**: Limit further data exposure
3. **Notify**: Inform supervisory authority within 72 hours (GDPR Article 33)
4. **Document**: Record all breach details in audit logs
5. **Remediate**: Fix the vulnerability
6. **Review**: Update security measures

### Data Subject Request

1. **Verify Identity**: Confirm requester is the data subject
2. **Process Request**: Execute within 30 days (GDPR Article 12)
3. **Log Action**: Record in audit logs
4. **Notify**: Confirm completion to data subject

## 12. Compliance Checklist

- [ ] Generate TLS certificates (`./scripts/generate-certs.sh`)
- [ ] Configure Scaleway Object Storage credentials
- [ ] Set strong `BACKUP_ENCRYPTION_KEY`
- [ ] Set strong `REDIS_PASSWORD`
- [ ] Verify backup container is running
- [ ] Verify retention-cleanup container is running
- [ ] Test data export endpoint
- [ ] Test deletion request flow
- [ ] Review audit logs periodically
- [ ] Document data processing activities (Article 30)
