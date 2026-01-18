#!/usr/bin/env python3
"""
Immutable Backup Agent for PostgreSQL
Creates compressed, checksummed, and immutable database backups
"""

import os
import subprocess
import hashlib
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import sys

class ImmutableBackupAgent:
    def __init__(self):
        self.staging_dir = Path("/backups/staging")
        self.active_dir = Path("/backups/active")
        self.log_file = Path("/backups/logs/backup_audit.jsonl")
        
        # Ensure directories exist
        self.staging_dir.mkdir(parents=True, exist_ok=True)
        self.active_dir.mkdir(parents=True, exist_ok=True)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
        
    def create_backup(self, backup_type="hourly"):
        """Create a new immutable backup"""
        print(f"🚀 Starting {backup_type} backup...")
        
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"{timestamp}.sql.gz"
        
        try:
            # Step 1: Create backup in staging (writable)
            print("  📝 Dumping database...")
            staging_path = self.staging_dir / f"{timestamp}.tmp"
            self._dump_database(staging_path)
            
            # Step 2: Compress
            print("  🗜️  Compressing...")
            compressed_path = self.staging_dir / filename
            self._compress(staging_path, compressed_path)
            staging_path.unlink()  # Remove temp file
            
            # Step 3: Generate checksum
            print("  🔐 Generating checksum...")
            checksum = self._generate_checksum(compressed_path)
            
            # Step 4: Create manifest
            manifest = {
                "filename": filename,
                "timestamp": timestamp,
                "type": backup_type,
                "size_bytes": compressed_path.stat().st_size,
                "sha256": checksum,
                "database": os.environ.get("DB_NAME", "app_db"),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "immutable": True,
                "version": "1.0"
            }
            
            # Step 5: Move to active directory
            print("  📦 Moving to active storage...")
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
            print("  🔒 Making immutable...")
            immutable_count = 0
            if self._make_immutable(backup_path):
                immutable_count += 1
            if self._make_immutable(checksum_path):
                immutable_count += 1
            if self._make_immutable(manifest_path):
                immutable_count += 1
            
            if immutable_count == 3:
                print("     ✅ All files made immutable")
            else:
                print(f"     ⚠️  Immutability not supported, using strict permissions")
            
            # Step 7: Log to audit trail
            self._log_backup(manifest)
            
            # Step 8: Cleanup old backups
            print("  🧹 Cleaning up old backups...")
            cleaned = self._cleanup_old_backups(backup_type)
            if cleaned > 0:
                print(f"     Removed {cleaned} old backup(s)")
            
            print(f"✅ Backup created successfully: {filename}")
            print(f"   Size: {manifest['size_bytes'] / 1024 / 1024:.2f} MB")
            print(f"   SHA256: {checksum[:16]}...")
            
            return manifest
            
        except Exception as e:
            print(f"❌ Backup failed: {e}")
            self._log_error(backup_type, str(e))
            raise
    
    def _dump_database(self, output_path):
        """Dump PostgreSQL database"""
        cmd = [
            "pg_dump",
            "-h", os.environ.get("DB_HOST", "db"),
            "-p", os.environ.get("DB_PORT", "5432"),
            "-U", os.environ.get("DB_USER", "app"),
            "-d", os.environ.get("DB_NAME", "app_db"),
            "-F", "p",  # Plain SQL format
            "-f", str(output_path),
            "--no-owner",  # Don't include ownership commands
            "--no-privileges",  # Don't include privilege commands
        ]
        
        env = os.environ.copy()
        password_file = os.environ.get("DB_PASSWORD_FILE")
        if password_file:
            with open(password_file) as f:
                env["PGPASSWORD"] = f.read().strip()
        
        result = subprocess.run(cmd, env=env, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception(f"pg_dump failed: {result.stderr}")
    
    def _compress(self, input_path, output_path):
        """Compress with gzip"""
        with open(output_path, "wb") as out_file:
            result = subprocess.run(
                ["gzip", "-9", "-c", str(input_path)],
                stdout=out_file,
                capture_output=False,
                check=True
            )
    
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
            result = subprocess.run(
                ["chattr", "+i", str(file_path)],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                return True
            else:
                # Fall back to strict permissions
                os.chmod(file_path, 0o400)  # r-- only for owner
                return False
        except FileNotFoundError:
            # chattr not available (non-Linux or no permissions)
            # Fall back to strict permissions
            os.chmod(file_path, 0o400)  # r-- only for owner
            return False
    
    def _remove_immutable(self, file_path):
        """Remove immutable flag before deletion"""
        try:
            subprocess.run(
                ["chattr", "-i", str(file_path)],
                capture_output=True,
                check=False
            )
        except FileNotFoundError:
            pass
    
    def _log_backup(self, manifest):
        """Append to audit log (append-only)"""
        log_entry = {
            "event": "backup_created",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "manifest": manifest
        }
        
        with self.log_file.open("a") as f:
            f.write(json.dumps(log_entry) + "\n")
    
    def _log_error(self, backup_type, error):
        """Log error to audit log"""
        log_entry = {
            "event": "backup_failed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "backup_type": backup_type,
            "error": error
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
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
        cutoff_timestamp = cutoff.timestamp()
        
        target_dir = self.active_dir / backup_type
        if not target_dir.exists():
            return 0
        
        removed_count = 0
        for backup_file in target_dir.glob("*.sql.gz"):
            if backup_file.stat().st_mtime < cutoff_timestamp:
                try:
                    # Remove immutable flag before deletion
                    self._remove_immutable(backup_file)
                    backup_file.unlink()
                    
                    # Also remove associated files
                    checksum_file = Path(f"{backup_file}.sha256")
                    manifest_file = Path(f"{backup_file}.manifest.json")
                    
                    if checksum_file.exists():
                        self._remove_immutable(checksum_file)
                        checksum_file.unlink()
                    
                    if manifest_file.exists():
                        self._remove_immutable(manifest_file)
                        manifest_file.unlink()
                    
                    removed_count += 1
                    
                    # Log cleanup
                    log_entry = {
                        "event": "backup_removed",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "filename": backup_file.name,
                        "type": backup_type,
                        "reason": "retention_policy"
                    }
                    with self.log_file.open("a") as f:
                        f.write(json.dumps(log_entry) + "\n")
                        
                except Exception as e:
                    print(f"  ⚠️  Failed to cleanup {backup_file}: {e}")
        
        return removed_count

def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        backup_type = sys.argv[1]
        if backup_type not in ["hourly", "daily", "weekly"]:
            print(f"❌ Invalid backup type: {backup_type}")
            print("   Usage: backup.py [hourly|daily|weekly]")
            sys.exit(1)
    else:
        backup_type = "hourly"
    
    try:
        agent = ImmutableBackupAgent()
        manifest = agent.create_backup(backup_type)
        sys.exit(0)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
