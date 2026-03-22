# Disaster Recovery

Date: 2026-01-18

## Goal

Provide a repeatable recovery process for PostgreSQL using immutable backups.

## Preconditions

- Access to the backup volume (`backup_data`) or S3 bucket with Object Lock.
- PostgreSQL service stopped or isolated before restore.
- Correct DB credentials and permissions.

## Restore from Local Backup

1. Stop the backend and DB containers:
   - `docker compose stop backend db`
2. Locate the latest backup:
   - `/backups/active/daily/<timestamp>.sql.gz`
3. Verify checksum:
   - `sha256sum -c <timestamp>.sql.gz.sha256`
4. Restore into a clean database:
   - Drop and recreate `app_db` (or use a new DB name)
   - Run:
     - `gzip -dc <timestamp>.sql.gz | psql -U app -d app_db`
5. Restart services:
   - `docker compose up -d db backend`

## Restore from S3 Object Lock

1. Download the backup object:
   - `aws s3 cp s3://<bucket>/<prefix>/<type>/<timestamp>.sql.gz ./`
2. Download checksum and manifest:
   - `aws s3 cp s3://<bucket>/<prefix>/<type>/<timestamp>.sql.gz.sha256 ./`
   - `aws s3 cp s3://<bucket>/<prefix>/<type>/<timestamp>.sql.gz.manifest.json ./`
3. Verify checksum:
   - `sha256sum -c <timestamp>.sql.gz.sha256`
4. Restore into a clean database:
   - `gzip -dc <timestamp>.sql.gz | psql -U app -d app_db`

## Validation

- Run a health check: `curl http://localhost:5300/api/health`
- Validate critical tables exist:
  - `entities`, `classes`, `relationships`, `users`
- Spot check authentication:
  - Login with a known account

## RPO / RTO Targets

- **RPO**: 1 hour (hourly backups)
- **RTO**: < 1 hour for local restore; < 2 hours for S3 restore

## What NOT to do

- Do not restore into a running production DB.
- Do not bypass checksum verification.
- Do not delete Object Lock backups during incident response.
- Do not reuse compromised credentials.
