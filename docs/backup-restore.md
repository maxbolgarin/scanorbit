# Backups and restore

ScanOrbit's state lives in two places: PostgreSQL (everything that
matters) and Redis (job queue, rate-limit counters, sessions). Redis is
disposable — losing it means the next scan re-enqueues itself. PostgreSQL
is not. Back it up.

## What's in PostgreSQL

- Organizations, users, API keys
- AWS account connections (external IDs encrypted with `OAUTH_ENCRYPTION_KEY`)
- Scan history, discovered resources, findings
- Audit logs
- Webhook / Slack / notification configuration

## Backing up PostgreSQL

The Compose stack publishes Postgres on `127.0.0.1:15432` by default, so
you can run `pg_dump` from the host without entering the container.

```bash
# Daily, custom-format dump (compressed, parallel restore later)
pg_dump \
  --host=127.0.0.1 --port=15432 \
  --username=scanorbit --dbname=scanorbit \
  --format=custom --no-owner --no-acl \
  --file=/var/backups/scanorbit/$(date +%F).dump
```

Drop that in cron / systemd-timer / a backup tool of your choice. A
sensible rotation is 14 daily + 12 monthly snapshots, kept on
storage that survives the box (S3, B2, Restic, etc.).

If you'd rather snapshot the volume, the named volume is `postgres_data`.
**Stop the `db` service before snapshotting** to avoid torn pages, or use
filesystem-level consistent snapshots (LVM, ZFS, EBS) and trust them.

## Restoring PostgreSQL

```bash
docker compose down                 # stop API + workers + db
docker volume rm scanorbit_postgres_data
docker compose up -d db             # fresh volume, schema-less

pg_restore \
  --host=127.0.0.1 --port=15432 \
  --username=scanorbit --dbname=scanorbit \
  --clean --if-exists --no-owner --no-acl \
  /var/backups/scanorbit/2026-05-18.dump

docker compose up -d                 # bring everything else back
```

The `migrate` service will run on the next `up` and bring the restored
schema forward if you've upgraded ScanOrbit in the meantime.

## Backing up Redis

Optional. Redis stores transient state — losing it means in-flight scans
get re-queued and rate-limit counters reset. If you want durability anyway,
the official Redis image already RDB-snapshots on shutdown into
`/data/dump.rdb` (mounted at the `redis_data` volume). For tighter RPO,
add `--save 60 1` to the compose command or switch to AOF.

## Test your restore

A backup you've never restored is theoretical. Once a quarter, restore
into a throwaway compose stack on a different machine, point a browser at
it, and confirm scans run. If you skip this step, your first real restore
will be the moment you discover the dump was empty.

## What's not in the backup

- `.env` itself — store it in your secret manager / password manager
  alongside this runbook. **Losing `OAUTH_ENCRYPTION_KEY` makes every
  encrypted secret in the DB unreadable** (AWS account external IDs,
  webhook secrets, Slack tokens, OAuth refresh tokens).
- Customer AWS data — ScanOrbit only stores resource metadata; the source
  of truth is AWS itself. A re-scan rebuilds the inventory from scratch.
