# 🚀 Immutable Backup System - Quick Start

## TL;DR

**3 commands to deploy ransomware-resistant backups:**

```bash
# 1. Build services
docker-compose build backup-agent backup-extractor

# 2. Start services
docker-compose up -d backup-agent backup-extractor

# 3. Verify (wait 2 minutes)
ls -lah external_storage/daily/$(date +%Y-%m-%d)/
```

---

## What You Get

```
┌──────────────────────────────────────────────────────────────┐
│                     YOUR BACKUPS                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  external_storage/                                           │
│  ├── daily/2026-01-18/                                       │
│  │   ├── 2026-01-18_00-00-00.sql.gz       (20MB compressed) │
│  │   ├── 2026-01-18_00-00-00.sql.gz.sha256    (checksum)    │
│  │   └── 2026-01-18_00-00-00.sql.gz.manifest.json           │
│  ├── hourly/2026-01-18/                                      │
│  └── weekly/2026-01-13/                                      │
│                                                              │
│  ✅ Immutable (cannot be encrypted by ransomware)            │
│  ✅ Verified (SHA-256 checksums)                             │
│  ✅ Ready to move (rsync/S3/NAS)                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## How It Works

```
   ┌────────────┐
   │ PostgreSQL │ Your database
   └─────┬──────┘
         │ pg_dump
         ▼
   ┌────────────┐
   │   Agent    │ Creates backups every hour
   └─────┬──────┘
         │ chattr +i (immutable)
         ▼
   ┌────────────┐
   │ Immutable  │ Cannot be modified/deleted
   │  Storage   │ (even by ransomware!)
   └─────┬──────┘
         │ read-only mount
         ▼
   ┌────────────┐
   │ Extractor  │ Verifies + copies (one-way)
   └─────┬──────┘
         │ SHA-256 check
         ▼
   ┌────────────┐
   │   Files    │ external_storage/ directory
   │   Ready!   │ Ready for offsite sync
   └────────────┘
```

---

## Quick Commands

### Check Backups

```bash
# List all backups
docker exec ontology-manager-backup-agent-1 ls -lR /backups/active/

# Check external storage
ls -lah external_storage/daily/$(date +%Y-%m-%d)/

# View audit logs
docker exec ontology-manager-backup-agent-1 cat /backups/logs/backup_audit.jsonl | tail -5
```

### Manual Backup

```bash
# Create immediate backup
docker exec ontology-manager-backup-agent-1 /usr/local/bin/backup.py daily

# Force extraction
docker exec ontology-manager-backup-extractor-1 /usr/local/bin/extractor.py once
```

### Verify Integrity

```bash
# Check all checksums
cd external_storage/daily/$(date +%Y-%m-%d)/ && sha256sum -c *.sha256
```

### Restore Database

```bash
# Get latest backup
BACKUP=$(ls -t external_storage/daily/*/*.sql.gz | head -1)

# Restore
gunzip -c "$BACKUP" | docker exec -i ontology-manager-db-1 psql -U app -d app_db
```

---

## Test Immutability

```bash
# Try to modify (should fail)
docker exec ontology-manager-backup-agent-1 sh -c \
  "echo 'hack' >> /backups/active/daily/*.sql.gz"
# Output: Operation not permitted ✅

# Try to delete (should fail)
docker exec ontology-manager-backup-agent-1 sh -c \
  "rm /backups/active/daily/*.sql.gz"
# Output: Operation not permitted ✅
```

---

## Monitoring

```bash
# Check service status
docker-compose ps backup-agent backup-extractor

# View logs
docker-compose logs -f backup-agent backup-extractor

# Disk usage
docker exec ontology-manager-backup-agent-1 du -sh /backups/active/*
```

---

## Offsite Sync (Optional)

### Option 1: Rsync to Remote Server

```bash
# Add to cron: sync every hour
0 * * * * rsync -avz /path/to/external_storage/ user@backup-server:/backups/
```

### Option 2: S3 Sync

```bash
# Install AWS CLI, then:
aws s3 sync external_storage/ s3://my-backup-bucket/ontology-manager/ --delete
```

### Option 3: NAS Mount

```bash
# Mount NAS, then update docker-compose.yml:
volumes:
  - /mnt/nas/backups:/external:rw
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No backups created | Check logs: `docker-compose logs backup-agent` |
| Immutability not working | Normal on Docker Mac/Windows (uses permissions instead) |
| Extractor not copying | Force run: `docker exec ... /usr/local/bin/extractor.py once` |
| Disk space full | Adjust retention in `backup-agent/backup.py` |

---

## Documentation

- **[IMMUTABLE_BACKUP_DESIGN.md](./IMMUTABLE_BACKUP_DESIGN.md)** - Full architecture
- **[IMMUTABLE_BACKUP_DEPLOYMENT.md](./IMMUTABLE_BACKUP_DEPLOYMENT.md)** - Detailed guide
- **[IMMUTABLE_BACKUP_README.md](./IMMUTABLE_BACKUP_README.md)** - Complete reference
- **[IMMUTABLE_BACKUP_SUMMARY.md](./IMMUTABLE_BACKUP_SUMMARY.md)** - Executive summary

---

## Support

**Questions?** Check the documentation above or:
1. Review logs: `docker-compose logs backup-agent backup-extractor`
2. Test manually: `docker exec ... /usr/local/bin/backup.py daily`
3. Verify checksums: `sha256sum -c *.sha256`

---

**🎯 You're protected! Backups are immutable and ready for offsite transfer.**
