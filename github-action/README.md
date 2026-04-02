# ScanOrbit GitHub Action

Trigger ScanOrbit AWS infrastructure scans from your CI/CD pipeline. Get security findings reported directly in your GitHub workflow.

## Prerequisites

- A ScanOrbit account with **Team tier** (API key access)
- An API key generated from Settings > API Keys
- At least one AWS account connected in ScanOrbit

## Usage

### Basic — scan on every push

```yaml
name: Security Scan
on: push

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: scanorbit/scanorbit-action@v1
        with:
          api-key: ${{ secrets.SCANORBIT_API_KEY }}
          account-id: 'your-account-uuid'
```

### Scheduled weekly scan

```yaml
name: Weekly Security Scan
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM UTC

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: scanorbit/scanorbit-action@v1
        with:
          api-key: ${{ secrets.SCANORBIT_API_KEY }}
          account-id: 'your-account-uuid'
          fail-on-critical: 'false'
```

### After Terraform apply

```yaml
name: Post-Deploy Scan
on:
  workflow_run:
    workflows: ['Deploy Infrastructure']
    types: [completed]

jobs:
  scan:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    steps:
      - uses: scanorbit/scanorbit-action@v1
        id: scan
        with:
          api-key: ${{ secrets.SCANORBIT_API_KEY }}
          account-id: 'your-account-uuid'
          timeout: '900'

      - name: Report
        if: always()
        run: |
          echo "Findings: ${{ steps.scan.outputs.findings-count }}"
          echo "Critical: ${{ steps.scan.outputs.critical-count }}"
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | — | ScanOrbit API key |
| `account-id` | Yes | — | AWS account UUID from ScanOrbit |
| `api-url` | No | `https://api.scanorbit.cloud` | API base URL |
| `fail-on-critical` | No | `true` | Fail workflow on critical findings |
| `wait-for-completion` | No | `true` | Wait for scan to finish |
| `timeout` | No | `600` | Max seconds to wait |

## Outputs

| Output | Description |
|--------|-------------|
| `scan-id` | UUID of the triggered scan |
| `findings-count` | Total number of findings |
| `critical-count` | Number of critical findings |

## Job Summary

The action automatically writes a findings summary table to the GitHub Actions job summary, visible in the workflow run UI.
