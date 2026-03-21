# Section 04 Code Review

## Contract Compliance: PASS
Role validation, base-exists check, transaction atomicity, topological sort before tx, clean swap, service pattern.

## Issues

### CRITICAL: Cross-source parent_class_id resolution broken
name_to_id only has current batch classes. Extension class with parent from base → NULL parent_class_id.

### CRITICAL: Extension flag clearing leaves orphan data
Clearing is_extension on old source doesn't unload its data. Old source's classes/properties remain with no flag.

### MEDIUM: imported_at mismatch (NOW() vs Utc::now())
Database gets server time, response gets application time.

### MEDIUM: Conflict detection allows duplicate rows
Both base and extension classes with same name coexist in classes table.

### LOW: No stats column update
import_source computes stats but doesn't write to ontology_sources.stats.

### LOW: source_conflicts has no FK constraints
Orphan conflict rows if source deleted outside unload_source.
