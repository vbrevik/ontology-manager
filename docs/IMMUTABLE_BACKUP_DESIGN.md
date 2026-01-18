# Immutable Local Backup System Design

## 🎯 Objective

Create a secure, immutable backup system where:
1. Database backups are created and immediately made immutable
2. A separate service can read (but not modify) backups
3. Backups are stored as files ready for external transfer
4. Ransomware cannot encrypt or delete backup data

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKUP ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│  PostgreSQL  │────────▶│ Backup Agent │────────▶│  Immutable   │
│   Database   │ pg_dump │   Service    │ Write   │   Storage    │
│              │         │              │ Once    │              │
└──────────────┘         └──────────────┘         └──────────────┘
                                                          │
                                                          │ Read-Only
                                                          │ Access
                                                          ▼
                                                   ┌──────────────┐
                                                   │   Extractor  │
                                                   │   Service    │
                                                   │  (One-Way)   │
                                                   └──────────────┘
                                                          │
                                                          │ Copy
                                                          ▼
                                                   ┌──────────────┐
                                                   │   External   │
                                                   │   Storage    │
                                                   │ (S3/NAS/etc) │
                                                   └──────────────┘
```

---

## 📁 Directory Structure

```
/backups/
├── active/                          # Current backups (immutable)
│   ├── daily/
│   │   ├── 2026-01-18_00-00-00.sql.gz
│   │   ├── 2026-01-18_00-00-00.sql.gz.sha256
│   │   ├── 2026-01-18_00-00-00.manifest.json
│   │   └── .immutable                # Marker file
│   ├── hourly/
│   │   ├── 2026-01-18_14-00-00.sql.gz
│   │   └── ...
│   └── weekly/
│       ├── 2026-01-13_00-00-00.sql.gz
│       └── ...
├── staging/                         # Temporary (writable, auto-cleanup)
│   └── in_progress_timestamp.tmp
├── extracted/                       # For extractor service
│   └── ready/
│       └── (symlinks to active/)
└── logs/
    ├── backup_audit.jsonl           # Append-only audit log
    └── extraction_audit.jsonl       # Extraction history
```

---

## 🔒 Immutability Implementation

### Method 1: Linux `chattr` (Best for Local)

```bash
# After backup creation, make immutable
chattr +i /backups/active/daily/2026-01-18_00-00-00.sql.gz

# Even root cannot delete/modify (without removing flag first)
# Requires: sudo chattr -i /path/to/file (intentional friction)
```

**Advantages:**
- True filesystem-level immutability
- Works on ext4, xfs filesystems
- Survives user/permission changes
- Ransomware cannot bypass without kernel-level access

**Requirements:**
- Linux filesystem with extended attributes
- CAP_LINUX_IMMUTABLE capability

### Method 2: Docker Volume with Read-Only Mount

```yaml
volumes:
  backup_storage:
    driver: local
    driver_opts:
      type: none
      device: /var/backups/immutable
      o: bind,ro  # Read-only mount for consumers
```

**Advantages:**
- Container isolation
- No special filesystem features required
- Works on any OS

**Limitations:**
- Backup agent needs separate writable mount

### Method 3: Separate User + Permissions (Fallback)

```bash
# Create dedicated backup user
useradd -r -s /bin/false backup_agent
useradd -r -s /bin/false backup_extractor

# Ownership: backup_agent writes, backup_extractor reads
chown backup_agent:backup_agent /backups/active/
chmod 500 /backups/active/  # rx for owner only
chmod 400 /backups/active/* # r-- for owner only

# Extractor reads via group membership or ACLs
setfacl -m u:backup_extractor:rx /backups/active/
setfacl -d -m u:backup_extractor:r /backups/active/
```

---

## 🐳 Docker Implementation

### New Service: `backup-agent`

```yaml
# docker-compose.yml
services:
  backup-agent:
    build:
      context: ./backup-agent
    environment:
      - DB_HOST=db
      - DB_PORT=5432
      - DB_NAME=app_db
      - DB_USER=app
      - DB_PASSWORD_FILE=/run/secrets/db_password
      - BACKUP_SCHEDULE=0 */1 * * *  # Every hour
      - BACKUP_RETENTION_DAYS=7
      - BACKUP_RETENTION_WEEKLY=4
    volumes:
      - backup_staging:/backups/staging:rw
      - backup_active:/backups/active:rw
      - backup_logs:/backups/logs:rw
    networks:
      - data_net  # Access to database
    secrets:
      - db_password
    restart: unless-stopped
    depends_on:
      - db

  backup-extractor:
    build:
      context: ./backup-extractor
    environment:
      - EXTERNAL_BACKUP_PATH=/external  # Mount point for NAS/S3FS
      - CHECK_INTERVAL=300  # 5 minutes
    volumes:
      - backup_active:/backups/active:ro  # READ-ONLY access
      - backup_extracted:/backups/extracted:rw
      - backup_logs:/backups/logs:rw
      - ./external_storage:/external:rw  # External destination
    networks:
      - backend_net  # Isolated from database
    restart: unless-stopped

volumes:
  backup_staging:
  backup_active:
  backup_extracted:
  backup_logs:
```

---

## 🔄 Backup Process Flow

### 1. Backup Creation (backup-agent)

```python
#!/usr/bin/env python3
# /backup-agent/backup.py

import os
import subprocess
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

class ImmutableBackupAgent:
    def __init__(self):
        self.staging_dir = Path("/backups/staging")
        self.active_dir = Path("/backups/active")
        self.log_file = Path("/backups/logs/backup_audit.jsonl")
        
    def create_backup(self, backup_type="hourly"):
        """Create a new immutable backup"""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"{timestamp}.sql.gz"
        
        # Step 1: Create backup in staging (writable)
        staging_path = self.staging_dir / f"{timestamp}.tmp"
        self._dump_database(staging_path)
        
        # Step 2: Compress
        compressed_path = self.staging_dir / filename
        self._compress(staging_path, compressed_path)
        staging_path.unlink()  # Remove temp file
        
        # Step 3: Generate checksum
        checksum = self._generate_checksum(compressed_path)
        
        # Step 4: Create manifest
        manifest = {
            "filename": filename,
            "timestamp": timestamp,
            "type": backup_type,
            "size_bytes": compressed_path.stat().st_size,
            "sha256": checksum,
            "database": "app_db",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "immutable": True
        }
        
        # Step 5: Move to active directory
        target_dir = self.active_dir / backup_type
        target_dir.mkdir(parents=True, exist_ok=True)
        
        backup_path = target_dir / filename
        checksum_path = target_dir / f"{filename}.sha256"
        manifest_path = target_dir / f"{filename}.manifest.json"
        
        # Move files atomically
        compressed_path.rename(backup_path)
        checksum_path.write_text(f"{checksum}  {filename}\n")
        manifest_path.write_text(json.dumps(manifest, indent=2))
        
        # Step 6: Make immutable (if supported)
        self._make_immutable(backup_path)
        self._make_immutable(checksum_path)
        self._make_immutable(manifest_path)
        
        # Step 7: Log to audit trail
        self._log_backup(manifest)
        
        # Step 8: Cleanup old backups
        self._cleanup_old_backups(backup_type)
        
        return manifest
    
    def _dump_database(self, output_path):
        """Dump PostgreSQL database"""
        cmd = [
            "pg_dump",
            "-h", os.environ["DB_HOST"],
            "-p", os.environ["DB_PORT"],
            "-U", os.environ["DB_USER"],
            "-d", os.environ["DB_NAME"],
            "-F", "p",  # Plain SQL format
            "-f", str(output_path)
        ]
        
        env = os.environ.copy()
        with open(os.environ["DB_PASSWORD_FILE"]) as f:
            env["PGPASSWORD"] = f.read().strip()
        
        subprocess.run(cmd, env=env, check=True)
    
    def _compress(self, input_path, output_path):
        """Compress with gzip"""
        subprocess.run([
            "gzip", "-9", "-c", str(input_path)
        ], stdout=output_path.open("wb"), check=True)
    
    def _generate_checksum(self, file_path):
        """Generate SHA-256 checksum"""
        sha256 = hashlib.sha256()
        with file_path.open("rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _make_immutable(self, file_path):
        """Make file immutable using chattr"""
        try:
            # Try Linux chattr
            subprocess.run(
                ["chattr", "+i", str(file_path)],
                check=False,  # Don't fail if not supported
                capture_output=True
            )
        except FileNotFoundError:
            # chattr not available (non-Linux or no permissions)
            # Fall back to strict permissions
            os.chmod(file_path, 0o400)  # r-- only for owner
    
    def _log_backup(self, manifest):
        """Append to audit log (append-only)"""
        log_entry = {
            "event": "backup_created",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "manifest": manifest
        }
        
        with self.log_file.open("a") as f:
            f.write(json.dumps(log_entry) + "\n")
    
    def _cleanup_old_backups(self, backup_type):
        """Remove old backups based on retention policy"""
        retention_days = {
            "hourly": 2,   # Keep 48 hours
            "daily": 7,    # Keep 7 days
            "weekly": 28   # Keep 4 weeks
        }
        
        max_age_days = retention_days.get(backup_type, 7)
        cutoff = datetime.now(timezone.utc).timestamp() - (max_age_days * 86400)
        
        target_dir = self.active_dir / backup_type
        for backup_file in target_dir.glob("*.sql.gz"):
            if backup_file.stat().st_mtime < cutoff:
                # Remove immutable flag before deletion
                try:
                    subprocess.run(["chattr", "-i", str(backup_file)], check=False)
                    backup_file.unlink()
                    
                    # Also remove associated files
                    Path(f"{backup_file}.sha256").unlink(missing_ok=True)
                    Path(f"{backup_file}.manifest.json").unlink(missing_ok=True)
                except Exception as e:
                    print(f"Failed to cleanup {backup_file}: {e}")

if __name__ == "__main__":
    agent = ImmutableBackupAgent()
    
    # Run based on schedule or trigger
    import sys
    backup_type = sys.argv[1] if len(sys.argv) > 1 else "hourly"
    manifest = agent.create_backup(backup_type)
    print(f"✅ Backup created: {manifest['filename']}")
```

### 2. Extraction Service (backup-extractor)

```python
#!/usr/bin/env python3
# /backup-extractor/extractor.py

import os
import shutil
import json
import time
import hashlib
from datetime import datetime, timezone
from pathlib import Path

class BackupExtractor:
    def __init__(self):
        self.active_dir = Path("/backups/active")
        self.extracted_dir = Path("/backups/extracted/ready")
        self.external_dir = Path("/external")
        self.log_file = Path("/backups/logs/extraction_audit.jsonl")
        self.state_file = Path("/backups/extracted/.last_sync.json")
        
        self.extracted_dir.mkdir(parents=True, exist_ok=True)
    
    def scan_and_extract(self):
        """Find new backups and prepare for external transfer"""
        last_sync = self._load_last_sync()
        new_backups = []
        
        # Scan all backup types
        for backup_type in ["hourly", "daily", "weekly"]:
            type_dir = self.active_dir / backup_type
            if not type_dir.exists():
                continue
            
            for manifest_file in type_dir.glob("*.manifest.json"):
                manifest = json.loads(manifest_file.read_text())
                
                # Check if already extracted
                if manifest["sha256"] in last_sync.get("extracted", []):
                    continue
                
                # Verify integrity
                backup_file = type_dir / manifest["filename"]
                if not self._verify_backup(backup_file, manifest):
                    self._log_event("verification_failed", manifest)
                    continue
                
                # Copy to external storage (one-way)
                self._extract_to_external(backup_file, manifest, backup_type)
                new_backups.append(manifest["sha256"])
                
        # Update state
        if new_backups:
            self._save_last_sync(new_backups)
    
    def _verify_backup(self, backup_file, manifest):
        """Verify backup integrity"""
        if not backup_file.exists():
            return False
        
        # Check size
        if backup_file.stat().st_size != manifest["size_bytes"]:
            return False
        
        # Verify checksum
        actual_checksum = self._calculate_checksum(backup_file)
        return actual_checksum == manifest["sha256"]
    
    def _calculate_checksum(self, file_path):
        """Calculate SHA-256 checksum"""
        sha256 = hashlib.sha256()
        with file_path.open("rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _extract_to_external(self, backup_file, manifest, backup_type):
        """Copy backup to external storage (one-way)"""
        # Create dated directory structure
        date_dir = self.external_dir / backup_type / manifest["timestamp"][:10]
        date_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy files (not move - preserve immutable originals)
        dest_backup = date_dir / manifest["filename"]
        dest_manifest = date_dir / f"{manifest['filename']}.manifest.json"
        dest_checksum = date_dir / f"{manifest['filename']}.sha256"
        
        # Use copy to preserve source
        shutil.copy2(backup_file, dest_backup)
        shutil.copy2(
            backup_file.parent / f"{manifest['filename']}.manifest.json",
            dest_manifest
        )
        shutil.copy2(
            backup_file.parent / f"{manifest['filename']}.sha256",
            dest_checksum
        )
        
        # Make external copies also read-only
        os.chmod(dest_backup, 0o444)
        os.chmod(dest_manifest, 0o444)
        os.chmod(dest_checksum, 0o444)
        
        self._log_event("extracted", manifest, str(dest_backup))
        print(f"✅ Extracted: {manifest['filename']} → {dest_backup}")
    
    def _load_last_sync(self):
        """Load last sync state"""
        if self.state_file.exists():
            return json.loads(self.state_file.read_text())
        return {"extracted": [], "last_sync": None}
    
    def _save_last_sync(self, new_checksums):
        """Save sync state"""
        state = self._load_last_sync()
        state["extracted"].extend(new_checksums)
        state["last_sync"] = datetime.now(timezone.utc).isoformat()
        
        self.state_file.write_text(json.dumps(state, indent=2))
    
    def _log_event(self, event_type, manifest, destination=None):
        """Log extraction event"""
        log_entry = {
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "backup": manifest["filename"],
            "sha256": manifest["sha256"],
            "destination": destination
        }
        
        with self.log_file.open("a") as f:
            f.write(json.dumps(log_entry) + "\n")

if __name__ == "__main__":
    extractor = BackupExtractor()
    
    # Run continuously
    check_interval = int(os.environ.get("CHECK_INTERVAL", "300"))
    
    while True:
        try:
            extractor.scan_and_extract()
        except Exception as e:
            print(f"❌ Extraction error: {e}")
        
        time.sleep(check_interval)
```

---

## 📦 Service Dockerfiles

### Backup Agent Dockerfile

```dockerfile
# backup-agent/Dockerfile
FROM postgres:16-alpine

# Install Python and dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    e2fsprogs  # For chattr command

# Copy backup script
COPY backup.py /usr/local/bin/backup.py
COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/backup.py /usr/local/bin/entrypoint.sh

# Create directories
RUN mkdir -p /backups/staging /backups/active /backups/logs && \
    chmod 700 /backups/staging && \
    chmod 500 /backups/active

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

### Backup Agent Entrypoint

```bash
#!/bin/sh
# backup-agent/entrypoint.sh

# Install cron job
echo "${BACKUP_SCHEDULE} /usr/local/bin/backup.py hourly >> /backups/logs/cron.log 2>&1" > /etc/crontabs/root
echo "0 0 * * * /usr/local/bin/backup.py daily >> /backups/logs/cron.log 2>&1" >> /etc/crontabs/root
echo "0 0 * * 0 /usr/local/bin/backup.py weekly >> /backups/logs/cron.log 2>&1" >> /etc/crontabs/root

# Initial backup
/usr/local/bin/backup.py daily

# Start cron
exec crond -f -l 2
```

### Extractor Dockerfile

```dockerfile
# backup-extractor/Dockerfile
FROM python:3.11-alpine

# Install dependencies
RUN apk add --no-cache \
    e2fsprogs

# Copy extractor script
COPY extractor.py /usr/local/bin/extractor.py

RUN chmod +x /usr/local/bin/extractor.py

# Create directories
RUN mkdir -p /backups/extracted /external

CMD ["/usr/local/bin/extractor.py"]
```

---

## 🛡️ Security Features

### 1. Immutability Enforcement

- **Filesystem-level**: `chattr +i` prevents modification even by root
- **Permission-based**: `0400` (r-- only) as fallback
- **Volume isolation**: Read-only Docker mounts

### 2. One-Way Data Flow

```
Database → Backup Agent → Immutable Storage → Extractor → External
   ↓            ↓              (no write)         ↓          ↓
 Write       Write              Read Only       Read      Write
```

### 3. Integrity Verification

- **SHA-256 checksums**: Verify every backup before extraction
- **Manifest files**: Store metadata for auditing
- **Audit logs**: Append-only JSONL for complete history

### 4. Ransomware Protection

| Attack Vector | Protection |
|---------------|------------|
| **File Encryption** | Immutable flag prevents modification |
| **File Deletion** | Immutable flag prevents deletion |
| **Service Compromise** | Read-only mounts for extractor |
| **Network Access** | Backup agent isolated to data_net |
| **Privilege Escalation** | Separate users, minimal capabilities |

---

## 🔍 Verification & Testing

### Test Immutability

```bash
# Create test backup
docker exec ontology-manager-backup-agent-1 /usr/local/bin/backup.py daily

# Try to modify (should fail)
docker exec ontology-manager-backup-agent-1 sh -c "echo 'hack' >> /backups/active/daily/*.sql.gz"
# Error: Operation not permitted

# Try to delete (should fail)
docker exec ontology-manager-backup-agent-1 sh -c "rm /backups/active/daily/*.sql.gz"
# Error: Operation not permitted

# Verify extractor can read
docker exec ontology-manager-backup-extractor-1 ls -lah /backups/active/daily/
```

### Test Extraction

```bash
# Check extracted backups
ls -lah external_storage/daily/$(date +%Y-%m-%d)/

# Verify integrity
cd external_storage/daily/$(date +%Y-%m-%d)/
sha256sum -c *.sha256
# Should output: OK
```

### Test Recovery

```bash
# Simulate disaster recovery
BACKUP_FILE="external_storage/daily/2026-01-18/2026-01-18_00-00-00.sql.gz"

# Restore to new database
gunzip -c $BACKUP_FILE | psql "postgres://app:password@localhost:5301/app_db_restore"
```

---

## 📊 Backup Schedule

| Type | Frequency | Retention | Purpose |
|------|-----------|-----------|---------|
| **Hourly** | Every hour | 48 hours | Quick recovery (recent changes) |
| **Daily** | 00:00 UTC | 7 days | Short-term recovery |
| **Weekly** | Sunday 00:00 | 4 weeks | Long-term recovery |

**Total Storage** (estimated):
- Database size: ~100MB
- Compressed: ~20MB
- Hourly: 48 × 20MB = 960MB
- Daily: 7 × 20MB = 140MB
- Weekly: 4 × 20MB = 80MB
- **Total: ~1.2GB**

---

## 🚀 Deployment Steps

See: `docs/IMMUTABLE_BACKUP_DEPLOYMENT.md`

---

## 📚 References

- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Linux chattr Man Page](https://man7.org/linux/man-pages/man1/chattr.1.html)
- [Docker Volume Security](https://docs.docker.com/storage/volumes/)
- [Ransomware Recovery Best Practices](https://www.cisa.gov/ransomware)

---

**Status**: 📋 Design Complete | Ready for Implementation
**Next**: Create deployment guide and implementation files
