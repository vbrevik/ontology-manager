# Immutable Backups

Date: 2026-01-18

## Overview

This backup flow creates immutable PostgreSQL backups and optionally uploads them to S3 with Object Lock. Local backups are stored under `/backups/active` with strict permissions and optional Linux immutability. S3 uploads use Object Lock retention for WORM protection.

## Architecture

- **backup-agent** container runs `backup.py` on a cron schedule.
- **local storage** uses named volume `backup_data` to keep backup artifacts.
- **immutability** uses `chattr +i` when available, otherwise `chmod 0400`.
- **object storage (optional)** uses AWS S3 with Object Lock retention.

## Docker Compose Service

The backup agent runs as a dedicated container:

```yaml
backup:
  build:
    context: ./backup-agent
  environment:
    - DB_HOST=db
    - DB_PORT=5432
    - DB_USER=app
    - DB_NAME=app_db
    - DB_PASSWORD_FILE=/run/secrets/db_password
    - BACKUP_SCHEDULE=0 * * * *
    - BACKUP_RETENTION_HOURLY_DAYS=2
    - BACKUP_RETENTION_DAILY_DAYS=7
    - BACKUP_RETENTION_WEEKLY_DAYS=28
    - S3_OBJECT_LOCK_MODE=COMPLIANCE
    - S3_OBJECT_LOCK_DAYS=30
    - S3_REQUIRED=false
  volumes:
    - backup_data:/backups
  networks:
    - backend_net
  secrets:
    - db_password
```

## Environment Variables

### Database

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`
- `DB_PASSWORD_FILE` (reads DB password from Docker secret)

### Retention

- `BACKUP_RETENTION_HOURLY_DAYS` (default 2)
- `BACKUP_RETENTION_DAILY_DAYS` (default 7)
- `BACKUP_RETENTION_WEEKLY_DAYS` (default 28)
- `BACKUP_RETENTION_DAYS` (fallback for all types)

### S3 Object Lock (Optional)

- `S3_BUCKET` (enables S3 uploads when set)
- `S3_PREFIX` (default `backups`)
- `S3_OBJECT_LOCK_MODE` (`COMPLIANCE` or `GOVERNANCE`)
- `S3_OBJECT_LOCK_DAYS` (default 30)
- `S3_REGION` or `AWS_REGION`
- `S3_ENDPOINT_URL` (for MinIO or custom endpoints)
- `S3_STORAGE_CLASS` (optional)
- `S3_KMS_KEY_ID` (optional)
- `S3_REQUIRED` (`true` to fail backup if S3 upload fails)

## Backup Artifacts

Each backup creates:

- `<timestamp>.sql.gz` (compressed SQL dump)
- `<timestamp>.sql.gz.sha256` (checksum file)
- `<timestamp>.sql.gz.manifest.json` (metadata)
- `backup_audit.jsonl` (append-only audit log)

## Verification (Manual)

1. Check the audit log:
   - `/backups/logs/backup_audit.jsonl`
2. Verify checksum:
   - `sha256sum -c <timestamp>.sql.gz.sha256`
3. Confirm immutability:
   - Linux: `lsattr <file>`
   - Fallback: `chmod` should be `400`

## What NOT to do

- Do not store DB credentials in `docker-compose.yml`.
- Do not expose backup volumes via ports.
- Do not delete backups without removing immutability first.
- Do not enable S3 uploads without Object Lock configured.
- Do not change backup retention without updating recovery plans.
