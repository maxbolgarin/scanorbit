# Security Policy

## Supported versions

ScanOrbit is pre-1.0. Security fixes are issued against the latest released version (`main` branch / latest GitHub release). Older versions are not patched — please upgrade.

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.** Public reports give attackers a window between disclosure and the fix landing on operators' deployments.

Use **GitHub's private vulnerability reporting** for this repository:

→ https://github.com/maxbolgarin/scanorbit/security/advisories/new

This opens a private channel between you and the maintainers. We will:

1. Acknowledge receipt within **72 hours**.
2. Confirm the vulnerability and assess severity.
3. Develop a fix and prepare a release.
4. Coordinate a disclosure date with you.
5. Publish a security advisory and credit you (unless you prefer to remain anonymous).

If you cannot use GitHub's reporting (e.g., the issue is in GitHub itself, or you don't have an account), open a minimal public issue asking for a private contact channel — do not include vulnerability details.

## Scope

In scope:

- Source code in this repository (TypeScript + Go)
- Default Docker images built from this repository's Dockerfiles
- The example `docker-compose.yml`
- The IAM policy templates we publish for AWS connection

Out of scope:

- Vulnerabilities in third-party services (AWS, GitHub, Google OAuth, Resend, Slack, etc.) — report to those vendors directly
- Issues caused by an operator's misconfiguration of their own deployment (weak `JWT_SECRET`, public database port, missing TLS termination, etc.)
- Findings against forks or modified versions not maintained here
- The Astro marketing site under `apps/landing/` (it's a static GitHub Pages build, not part of the self-host stack)

## What we care about

High-priority report categories:

- Remote code execution
- Authentication bypass or privilege escalation
- SQL injection, command injection
- Cryptographic weaknesses in the at-rest encryption of OAuth tokens / TOTP secrets
- Leakage of secrets or AWS credentials in logs, error responses, or audit records
- IAM policy templates that grant more than read-only access
- Container or Docker image escape

Useful but lower-priority:

- Self-XSS, denial of service that requires authenticated abuse
- Issues fixed by a config change documented in the README

## Disclosure

We aim to publish a patched release within **30 days** of confirming a high-severity issue, faster for actively exploited issues. Public advisories include a description, affected versions, the fix version, and credit to the reporter.

## Hardening guidance for operators

If you operate a ScanOrbit deployment, the operational security of that deployment is your responsibility. See the README and `.env.example` for the relevant environment variables (`JWT_SECRET`, `*_ENCRYPTION_KEY`, `TRUSTED_PROXIES`, `DB_CA_CERT`, `REDIS_CA_CERT`) and the Docker Compose file for the default network exposure.

Thank you for helping keep ScanOrbit and its users safe.
