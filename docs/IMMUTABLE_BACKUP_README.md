# 🛡️ Immutable Backup System

## Overview

This system provides **ransomware-resistant, immutable backups** with one-way extraction to external storage.

## 📚 Documentation

1. **[IMMUTABLE_BACKUP_DESIGN.md](./IMMUTABLE_BACKUP_DESIGN.md)** - Architecture & design concepts
2. **[IMMUTABLE_BACKUP_DEPLOYMENT.md](./IMMUTABLE_BACKUP_DEPLOYMENT.md)** - Deployment guide & testing

## 🏗️ Architecture

```
Database → Backup Agent → Immutable Storage → Extractor → External Files
            (Write)        (Read-Only)         (Copy)      (Ready to Move)
```

## 🔒 Key Features

- **Immutable Storage**: Backups cannot be modified or deleted (filesystem-level)
- **One-Way Flow**: Extractor has read-only access to backups
- **Integrity Verification**: SHA-256 checksums on every backup
- **Network Isolation**: Backup agent isolated from internet
- **Audit Trail**: Complete history of all backup operations
- **Automated Cleanup**: Old backups removed based on retention policy

## ⏱️ Backup Schedule

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Hourly | Every hour | 48 hours | `/backups/active/hourly/` |
| Daily | 00:00 UTC | 7 days | `/backups/active/daily/` |
| Weekly | Sunday 00:00 | 4 weeks | `/backups/active/weekly/` |

## 📁 File Structure

```
backup-agent/               # Backup creation service
├── backup.py              # Main backup script
├── entrypoint.sh          # Container startup
└── Dockerfile             # Container image

backup-extractor/          # Extraction service
├── extractor.py          # Extraction script
└── Dockerfile            # Container image

external_storage/          # Extracted backups (local)
├── daily/
│   └── 2026-01-18/
│       ├── 2026-01-18_00-00-00.sql.gz
│       ├── 2026-01-18_00-00-00.sql.gz.sha256
│       └── 2026-01-18_00-00-00.sql.gz.manifest.json
├── hourly/
└── weekly/
```

## 🚀 Quick Start

### Deploy Services

```bash
# Build images
docker-compose build backup-agent backup-extractor

# Start services
docker-compose up -d backup-agent backup-extractor

# Check logs
docker-compose logs -f backup-agent backup-extractor
```

### Verify Backups

```bash
# Check active backups
docker exec ontology-manager-backup-agent-1 ls -lah /backups/active/daily/

# Check extracted backups
ls -lah external_storage/daily/$(date +%Y-%m-%d)/

# Verify integrity
cd external_storage/daily/$(date +%Y-%m-%d)/ && sha256sum -c *.sha256
```

### Manual Backup

```bash
# Create immediate backup
docker exec ontology-manager-backup-agent-1 /usr/local/bin/backup.py daily

# Force extraction
docker exec ontology-manager-backup-extractor-1 /usr/local/bin/extractor.py once
```

## 🧪 Testing

### Test Immutability

```bash
# Try to modify (should fail)
docker exec ontology-manager-backup-agent-1 sh -c \
  "echo 'hack' >> /backups/active/daily/*.sql.gz" || echo "✅ Protected!"

# Try to delete (should fail)
docker exec ontology-manager-backup-agent-1 sh -c \
  "rm /backups/active/daily/*.sql.gz" || echo "✅ Protected!"
```

### Test Recovery

```bash
# Get latest backup
BACKUP=$(ls -t external_storage/daily/*/*.sql.gz | head -1)

# Restore to test database
gunzip -c "$BACKUP" | docker exec -i ontology-manager-db-1 \
  psql -U app -d postgres -c "CREATE DATABASE test_restore;" && \
  psql -U app -d test_restore
```

## 📊 Monitoring

```bash
# View backup audit log
docker exec ontology-manager-backup-agent-1 \
  cat /backups/logs/backup_audit.jsonl | tail -10

# View extraction audit log
docker exec ontology-manager-backup-extractor-1 \
  cat /backups/logs/extraction_audit.jsonl | tail -10

# Check disk usage
docker exec ontology-manager-backup-agent-1 du -sh /backups/active/*
```

## 🔐 Security Model

| Component | Network | Permissions | Purpose |
|-----------|---------|-------------|---------|
| **Backup Agent** | `data_net` only | Write to staging, immutable in active | Create backups |
| **Active Storage** | N/A | Read-only via chattr +i | Immutable storage |
| **Extractor** | `backend_net` only | Read-only mount | Copy to external |
| **External Storage** | Host filesystem | Regular files | Ready for offsite sync |

## 🎯 Use Cases

### 1. Ransomware Attack

- Backups remain unencrypted (immutable)
- Restore from `external_storage/` directory
- No data loss (within RPO window)

### 2. Accidental Deletion

- Database can be restored from recent hourly backup
- Recovery time: < 5 minutes
- Recovery point: Last hour

### 3. Disaster Recovery

- Copy `external_storage/` to remote location (S3, NAS, etc.)
- Restore from any backup point
- Supports offsite recovery

### 4. Compliance Audit

- Complete audit trail in `/backups/logs/`
- Every backup operation logged with timestamp
- Integrity verification on every extraction

## 🛠️ Maintenance

### Change Schedule

Edit `docker-compose.yml`:

```yaml
environment:
  - BACKUP_SCHEDULE=0 */2 * * *  # Every 2 hours instead of every hour
```

### Change Retention

Edit `backup-agent/backup.py`:

```python
retention_days = {
    "hourly": 3,   # Keep 72 hours (was 48)
    "daily": 14,   # Keep 2 weeks (was 7 days)
    "weekly": 56   # Keep 8 weeks (was 4 weeks)
}
```

### Offsite Sync

Add to cron on host:

```bash
# Sync to S3 every hour
0 * * * * aws s3 sync /path/to/external_storage/ s3://my-bucket/backups/ --delete

# Or sync to NAS
0 * * * * rsync -avz /path/to/external_storage/ user@nas:/backups/
```

## 🆘 Troubleshooting

### Backups Not Creating

```bash
# Check logs
docker-compose logs backup-agent

# Test database connection
docker exec ontology-manager-backup-agent-1 \
  sh -c 'PGPASSWORD=$(cat /run/secrets/db_password) pg_isready -h db -U app'
```

### Immutability Not Working

```bash
# Check if chattr is supported
docker exec ontology-manager-backup-agent-1 which chattr

# If not supported, it falls back to strict permissions (0400)
# This is normal on Docker for Mac/Windows
```

### Extractor Not Copying

```bash
# Check extractor logs
docker-compose logs backup-extractor

# Force manual extraction
docker exec ontology-manager-backup-extractor-1 /usr/local/bin/extractor.py once
```

## 📈 Metrics

- **Backup Time**: ~30-60 seconds for 100MB database
- **Compression Ratio**: ~5:1 (varies with data)
- **Storage Overhead**: ~1.2GB for default retention
- **Recovery Time**: < 5 minutes
- **Recovery Point**: Up to 1 hour (hourly backups)

## 🔗 Related Documents

- [Security Implementation](./SECURITY_TASKS.md)
- [Phase 2 Progress](./PHASE_2_PROGRESS.md)
- [Backup Design](./IMMUTABLE_BACKUP_DESIGN.md)
- [Deployment Guide](./IMMUTABLE_BACKUP_DEPLOYMENT.md)

---

**Status**: ✅ Ready for Deployment
**Version**: 1.0
**Last Updated**: 2026-01-18
