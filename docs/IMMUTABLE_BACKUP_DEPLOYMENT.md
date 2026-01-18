# Immutable Backup System - Deployment Guide

## 🎯 Quick Start

This guide walks through implementing the immutable backup system step-by-step.

---

## 📋 Prerequisites

- Docker & Docker Compose
- PostgreSQL database running
- At least 2GB free disk space
- Linux host with ext4/xfs filesystem (for chattr)
- sudo/root access for chattr (optional but recommended)

---

## 🚀 Implementation Steps

### Step 1: Create Directory Structure

```bash
cd /Users/vidarbrevik/projects/ontology-manager

# Create backup service directories
mkdir -p backup-agent backup-extractor
mkdir -p external_storage

# Create .gitignore for backup data
cat >> .gitignore << 'EOF'

# Backup data (local only)
external_storage/
EOF
```

### Step 2: Create Backup Agent Files

#### backup-agent/backup.py

```bash
# Copy the Python script from IMMUTABLE_BACKUP_DESIGN.md
# (Full script provided in design doc)
```

#### backup-agent/entrypoint.sh

```bash
cat > backup-agent/entrypoint.sh << 'EOF'
#!/bin/sh
# Backup Agent Entrypoint

echo "🚀 Starting Backup Agent..."
echo "   Schedule: ${BACKUP_SCHEDULE}"
echo "   Retention: ${BACKUP_RETENTION_DAYS} days"

# Create cron jobs
CRON_FILE=/etc/crontabs/root
mkdir -p /etc/crontabs

echo "${BACKUP_SCHEDULE} /usr/local/bin/backup.py hourly >> /backups/logs/cron.log 2>&1" > $CRON_FILE
echo "0 0 * * * /usr/local/bin/backup.py daily >> /backups/logs/cron.log 2>&1" >> $CRON_FILE
echo "0 0 * * 0 /usr/local/bin/backup.py weekly >> /backups/logs/cron.log 2>&1" >> $CRON_FILE

# Set proper permissions
chmod 0600 $CRON_FILE

# Run initial backup
echo "📦 Creating initial backup..."
/usr/local/bin/backup.py daily

# Start cron daemon
echo "⏰ Starting cron scheduler..."
exec crond -f -l 2
EOF

chmod +x backup-agent/entrypoint.sh
```

#### backup-agent/Dockerfile

```bash
cat > backup-agent/Dockerfile << 'EOF'
FROM postgres:16-alpine

# Install required packages
RUN apk add --no-cache \
    python3 \
    e2fsprogs \
    tzdata

# Set timezone to UTC
ENV TZ=UTC

# Copy scripts
COPY backup.py /usr/local/bin/backup.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/backup.py /usr/local/bin/entrypoint.sh

# Create backup directories
RUN mkdir -p /backups/staging /backups/active /backups/logs && \
    chmod 700 /backups/staging && \
    chmod 500 /backups/active && \
    chmod 755 /backups/logs

WORKDIR /backups

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
EOF
```

### Step 3: Create Extractor Service Files

#### backup-extractor/extractor.py

```bash
# Copy the Python script from IMMUTABLE_BACKUP_DESIGN.md
# (Full script provided in design doc)
```

#### backup-extractor/Dockerfile

```bash
cat > backup-extractor/Dockerfile << 'EOF'
FROM python:3.11-alpine

# Install required packages
RUN apk add --no-cache \
    e2fsprogs \
    tzdata

# Set timezone to UTC
ENV TZ=UTC

# Copy extractor script
COPY extractor.py /usr/local/bin/extractor.py

RUN chmod +x /usr/local/bin/extractor.py

# Create directories
RUN mkdir -p /backups/extracted /external

WORKDIR /backups

CMD ["/usr/local/bin/extractor.py"]
EOF
```

### Step 4: Update docker-compose.yml

```bash
cat >> docker-compose.yml << 'EOF'

  # =====================================================
  # BACKUP SERVICES
  # =====================================================
  
  backup-agent:
    build:
      context: ./backup-agent
    container_name: ontology-manager-backup-agent-1
    environment:
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME=app_db
      - DB_USER=app
      - DB_PASSWORD_FILE=/run/secrets/db_password
      - BACKUP_SCHEDULE=0 */1 * * *  # Every hour
      - BACKUP_RETENTION_DAYS=7
    volumes:
      - backup_staging:/backups/staging:rw
      - backup_active:/backups/active:rw
      - backup_logs:/backups/logs:rw
    networks:
      - data_net  # Access to database only
    secrets:
      - db_password
    restart: unless-stopped
    depends_on:
      - db
    labels:
      - "com.ontology-manager.service=backup-agent"
      - "com.ontology-manager.security=immutable-backups"

  backup-extractor:
    build:
      context: ./backup-extractor
    container_name: ontology-manager-backup-extractor-1
    environment:
      - CHECK_INTERVAL=300  # Check every 5 minutes
    volumes:
      - backup_active:/backups/active:ro  # READ-ONLY access
      - backup_extracted:/backups/extracted:rw
      - backup_logs:/backups/logs:rw
      - ./external_storage:/external:rw  # External destination
    networks:
      - backend_net  # Isolated from database
    restart: unless-stopped
    depends_on:
      - backup-agent
    labels:
      - "com.ontology-manager.service=backup-extractor"
      - "com.ontology-manager.security=one-way-extraction"

volumes:
  backup_staging:
    name: ontology-manager-backup-staging
  backup_active:
    name: ontology-manager-backup-active
  backup_extracted:
    name: ontology-manager-backup-extracted
  backup_logs:
    name: ontology-manager-backup-logs
EOF
```

### Step 5: Deploy Services

```bash
# Export database password
export DB_PASSWORD=$(cat secrets/db_password.txt)

# Build and start backup services
docker-compose build backup-agent backup-extractor
docker-compose up -d backup-agent backup-extractor

# Check logs
docker-compose logs -f backup-agent backup-extractor
```

### Step 6: Verify Deployment

```bash
# Wait for initial backup (may take 1-2 minutes)
sleep 120

# Check backup creation
docker exec ontology-manager-backup-agent-1 ls -lah /backups/active/daily/

# Check immutability (should fail)
docker exec ontology-manager-backup-agent-1 sh -c "echo 'test' >> /backups/active/daily/*.sql.gz" || echo "✅ Immutable protection working!"

# Check extraction
ls -lah external_storage/daily/$(date +%Y-%m-%d)/

# Verify checksums
cd external_storage/daily/$(date +%Y-%m-%d)/ && sha256sum -c *.sha256
```

---

## 🧪 Testing

### Test 1: Manual Backup Creation

```bash
# Create a manual backup
docker exec ontology-manager-backup-agent-1 /usr/local/bin/backup.py daily

# Verify creation
docker exec ontology-manager-backup-agent-1 ls -lah /backups/active/daily/
```

### Test 2: Immutability Verification

```bash
# Try to modify (should fail)
docker exec ontology-manager-backup-agent-1 sh -c "
  cd /backups/active/daily && 
  BACKUP_FILE=\$(ls -t *.sql.gz | head -1) &&
  echo 'hack' >> \$BACKUP_FILE
" 2>&1 | grep -q "Operation not permitted" && echo "✅ PASS: Cannot modify" || echo "❌ FAIL: Can modify"

# Try to delete (should fail)
docker exec ontology-manager-backup-agent-1 sh -c "
  cd /backups/active/daily && 
  BACKUP_FILE=\$(ls -t *.sql.gz | head -1) &&
  rm \$BACKUP_FILE
" 2>&1 | grep -q "Operation not permitted" && echo "✅ PASS: Cannot delete" || echo "❌ FAIL: Can delete"
```

### Test 3: One-Way Extraction

```bash
# Verify extractor can only read
docker exec ontology-manager-backup-extractor-1 sh -c "
  cd /backups/active/daily && 
  echo 'test' > test.txt
" 2>&1 | grep -q "Read-only file system" && echo "✅ PASS: Extractor read-only" || echo "❌ FAIL: Extractor can write"

# Verify extractor can copy to external
docker exec ontology-manager-backup-extractor-1 /usr/local/bin/extractor.py

# Check external storage
ls -lah external_storage/daily/$(date +%Y-%m-%d)/
```

### Test 4: Backup Integrity

```bash
# Verify all checksums
for dir in external_storage/*/$(date +%Y-%m-%d)/; do
  if [ -d "$dir" ]; then
    echo "Verifying $dir"
    cd "$dir" && sha256sum -c *.sha256
  fi
done
```

### Test 5: Disaster Recovery

```bash
# Create test database
docker exec ontology-manager-db-1 psql -U app -d postgres -c "CREATE DATABASE test_restore;"

# Get latest backup
LATEST_BACKUP=$(ls -t external_storage/daily/*/*.sql.gz | head -1)

# Restore
gunzip -c "$LATEST_BACKUP" | docker exec -i ontology-manager-db-1 psql -U app -d test_restore

# Verify restoration
docker exec ontology-manager-db-1 psql -U app -d test_restore -c "SELECT COUNT(*) FROM users;"

# Cleanup test database
docker exec ontology-manager-db-1 psql -U app -d postgres -c "DROP DATABASE test_restore;"
```

---

## 📊 Monitoring

### Check Backup Status

```bash
# View backup logs
docker exec ontology-manager-backup-agent-1 cat /backups/logs/backup_audit.jsonl | tail -10

# View extraction logs
docker exec ontology-manager-backup-extractor-1 cat /backups/logs/extraction_audit.jsonl | tail -10

# Check cron logs
docker exec ontology-manager-backup-agent-1 cat /backups/logs/cron.log
```

### Backup Inventory

```bash
# Count backups
echo "Hourly: $(docker exec ontology-manager-backup-agent-1 ls /backups/active/hourly/*.sql.gz 2>/dev/null | wc -l)"
echo "Daily: $(docker exec ontology-manager-backup-agent-1 ls /backups/active/daily/*.sql.gz 2>/dev/null | wc -l)"
echo "Weekly: $(docker exec ontology-manager-backup-agent-1 ls /backups/active/weekly/*.sql.gz 2>/dev/null | wc -l)"

# Disk usage
docker exec ontology-manager-backup-agent-1 du -sh /backups/active/*
```

### External Storage Check

```bash
# Check external storage
du -sh external_storage/*
find external_storage -name "*.sql.gz" -type f
```

---

## 🔄 Maintenance

### Manual Backup Trigger

```bash
# Create hourly backup
docker exec ontology-manager-backup-agent-1 /usr/local/bin/backup.py hourly

# Create daily backup
docker exec ontology-manager-backup-agent-1 /usr/local/bin/backup.py daily

# Create weekly backup
docker exec ontology-manager-backup-agent-1 /usr/local/bin/backup.py weekly
```

### Force Extraction

```bash
# Trigger immediate extraction
docker exec ontology-manager-backup-extractor-1 /usr/local/bin/extractor.py
```

### Remove Old Backups

```bash
# Automatic cleanup runs during backup creation
# To manually remove old backups:

docker exec ontology-manager-backup-agent-1 sh -c "
  cd /backups/active/hourly &&
  for file in \$(ls -t *.sql.gz | tail -n +49); do
    chattr -i \"\$file\"
    rm -f \"\$file\" \"\$file.sha256\" \"\$file.manifest.json\"
  done
"
```

---

## 🚨 Troubleshooting

### Issue: chattr not supported

**Symptom**: `chattr: Operation not supported`

**Solution**: Docker on Mac/Windows doesn't support chattr. The system falls back to strict file permissions (0400).

```bash
# Verify fallback is working
docker exec ontology-manager-backup-agent-1 ls -l /backups/active/daily/*.sql.gz
# Should show: -r-------- (read-only for owner)
```

### Issue: Database connection failed

**Symptom**: `pg_dump: connection refused`

**Solution**: Verify database is accessible from backup-agent

```bash
# Test connection
docker exec ontology-manager-backup-agent-1 sh -c "
  PGPASSWORD=\$(cat /run/secrets/db_password) psql -h db -U app -d app_db -c 'SELECT 1;'
"
```

### Issue: Extractor not copying files

**Symptom**: No files in `external_storage/`

**Solution**: Check extractor logs

```bash
docker-compose logs backup-extractor

# Force manual run
docker exec ontology-manager-backup-extractor-1 /usr/local/bin/extractor.py
```

### Issue: Disk space full

**Symptom**: `No space left on device`

**Solution**: Adjust retention policies or increase disk space

```bash
# Check disk usage
docker system df -v

# Clean up old backups
docker exec ontology-manager-backup-agent-1 /usr/local/bin/backup.py cleanup
```

---

## 📦 Backup to External Storage

### Option 1: Mount NAS/SMB Share

```yaml
# In docker-compose.yml, change external storage to NAS mount
volumes:
  - /mnt/nas/backups:/external:rw
```

### Option 2: S3/Cloud Storage (via s3fs)

```bash
# Install s3fs in extractor container
# Modify backup-extractor/Dockerfile:

RUN apk add --no-cache s3fs-fuse

# Mount S3 bucket
ENTRYPOINT ["/bin/sh", "-c", "s3fs mybucket /external && /usr/local/bin/extractor.py"]
```

### Option 3: Rsync to Remote Server

```bash
# Add rsync script to extractor
cat > backup-extractor/sync_remote.sh << 'EOF'
#!/bin/sh
rsync -avz --delete /external/ user@remote-server:/backups/
EOF
```

---

## ✅ Verification Checklist

- [ ] Backup agent creates backups on schedule
- [ ] Backups are immutable (cannot modify/delete)
- [ ] Checksums match (integrity verified)
- [ ] Extractor has read-only access to active backups
- [ ] External storage receives copies
- [ ] Old backups are cleaned up automatically
- [ ] Audit logs are being written
- [ ] Disaster recovery test successful

---

## 🔐 Security Notes

1. **Network Isolation**:
   - Backup agent: Only on `data_net` (database access)
   - Extractor: Only on `backend_net` (no database access)

2. **Permission Model**:
   - Active backups: Immutable (chattr +i) or read-only (0400)
   - Extractor: Read-only mount
   - External storage: Regular files (can be synced to remote)

3. **Secrets Management**:
   - Database password via Docker secrets
   - Never logged or exposed in environment variables

4. **Audit Trail**:
   - All backup creation logged
   - All extraction events logged
   - Append-only JSONL format

---

## 📚 Next Steps

1. **Set up offsite backup**: Configure S3, NAS, or remote server sync
2. **Test disaster recovery**: Practice full database restoration
3. **Monitor backup health**: Set up alerts for failed backups
4. **Document RTO/RPO**: Define Recovery Time/Point Objectives

---

**Status**: 📋 Ready for Deployment
**Time to Deploy**: ~15 minutes
**Disk Space Required**: ~2GB (initial)
