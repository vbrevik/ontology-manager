#!/usr/bin/env python3
"""
Backup Extractor Service
One-way extraction of immutable backups to external storage
"""

import os
import shutil
import json
import time
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import sys

class BackupExtractor:
    def __init__(self):
        self.active_dir = Path("/backups/active")
        self.extracted_dir = Path("/backups/extracted/ready")
        self.external_dir = Path("/external")
        self.log_file = Path("/backups/logs/extraction_audit.jsonl")
        self.state_file = Path("/backups/extracted/.last_sync.json")
        
        # Ensure directories exist
        self.extracted_dir.mkdir(parents=True, exist_ok=True)
        self.external_dir.mkdir(parents=True, exist_ok=True)
        self.log_file.parent.mkdir(parents=True, exist_ok=True)
    
    def scan_and_extract(self):
        """Find new backups and prepare for external transfer"""
        print(f"🔍 Scanning for new backups... ({datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')})")
        
        last_sync = self._load_last_sync()
        new_backups = []
        total_processed = 0
        
        # Scan all backup types
        for backup_type in ["hourly", "daily", "weekly"]:
            type_dir = self.active_dir / backup_type
            if not type_dir.exists():
                continue
            
            for manifest_file in sorted(type_dir.glob("*.manifest.json")):
                total_processed += 1
                try:
                    manifest = json.loads(manifest_file.read_text())
                    
                    # Check if already extracted
                    if manifest["sha256"] in last_sync.get("extracted", []):
                        continue
                    
                    # Verify integrity
                    backup_file = type_dir / manifest["filename"]
                    if not self._verify_backup(backup_file, manifest):
                        print(f"  ❌ Verification failed: {manifest['filename']}")
                        self._log_event("verification_failed", manifest)
                        continue
                    
                    # Copy to external storage (one-way)
                    print(f"  📤 Extracting: {manifest['filename']} ({manifest['type']})")
                    self._extract_to_external(backup_file, manifest, backup_type)
                    new_backups.append(manifest["sha256"])
                    
                except Exception as e:
                    print(f"  ⚠️  Error processing {manifest_file.name}: {e}")
        
        # Update state
        if new_backups:
            self._save_last_sync(new_backups)
            print(f"✅ Extracted {len(new_backups)} new backup(s)")
        else:
            if total_processed > 0:
                print(f"✅ All {total_processed} backup(s) already extracted")
            else:
                print("ℹ️  No backups found")
    
    def _verify_backup(self, backup_file, manifest):
        """Verify backup integrity"""
        if not backup_file.exists():
            return False
        
        # Check size
        actual_size = backup_file.stat().st_size
        expected_size = manifest["size_bytes"]
        if actual_size != expected_size:
            print(f"    Size mismatch: {actual_size} != {expected_size}")
            return False
        
        # Verify checksum
        print(f"    🔐 Verifying checksum...")
        actual_checksum = self._calculate_checksum(backup_file)
        expected_checksum = manifest["sha256"]
        
        if actual_checksum != expected_checksum:
            print(f"    Checksum mismatch!")
            return False
        
        print(f"    ✅ Verified: {actual_checksum[:16]}...")
        return True
    
    def _calculate_checksum(self, file_path):
        """Calculate SHA-256 checksum"""
        sha256 = hashlib.sha256()
        with file_path.open("rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _extract_to_external(self, backup_file, manifest, backup_type):
        """Copy backup to external storage (one-way)"""
        # Create dated directory structure: /external/daily/2026-01-18/
        date_str = manifest["timestamp"][:10]  # YYYY-MM-DD
        date_dir = self.external_dir / backup_type / date_str
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
        
        checksum_src = backup_file.parent / f"{manifest['filename']}.sha256"
        if checksum_src.exists():
            shutil.copy2(checksum_src, dest_checksum)
        
        # Make external copies read-only
        os.chmod(dest_backup, 0o444)
        os.chmod(dest_manifest, 0o444)
        if dest_checksum.exists():
            os.chmod(dest_checksum, 0o444)
        
        size_mb = manifest['size_bytes'] / 1024 / 1024
        print(f"    ✅ Copied to: {date_dir.relative_to(self.external_dir)} ({size_mb:.2f} MB)")
        
        self._log_event("extracted", manifest, str(dest_backup))
    
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
        state["total_extracted"] = len(state["extracted"])
        
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

def main():
    """Main entry point"""
    print("╔════════════════════════════════════════════════════════╗")
    print("║                                                        ║")
    print("║      📤 BACKUP EXTRACTOR SERVICE v1.0 📤              ║")
    print("║                                                        ║")
    print("╚════════════════════════════════════════════════════════╝")
    print("")
    
    extractor = BackupExtractor()
    check_interval = int(os.environ.get("CHECK_INTERVAL", "300"))
    
    print(f"⏰ Check interval: {check_interval} seconds")
    print(f"📁 Active backups: /backups/active (read-only)")
    print(f"📁 External storage: /external")
    print("")
    
    # Run once immediately if requested
    if len(sys.argv) > 1 and sys.argv[1] == "once":
        try:
            extractor.scan_and_extract()
        except Exception as e:
            print(f"❌ Extraction error: {e}")
            sys.exit(1)
        sys.exit(0)
    
    # Run continuously
    print("🔄 Starting continuous monitoring...")
    print("")
    
    while True:
        try:
            extractor.scan_and_extract()
        except Exception as e:
            print(f"❌ Extraction error: {e}")
            import traceback
            traceback.print_exc()
        
        print(f"⏳ Next check in {check_interval} seconds...")
        print("")
        time.sleep(check_interval)

if __name__ == "__main__":
    main()
