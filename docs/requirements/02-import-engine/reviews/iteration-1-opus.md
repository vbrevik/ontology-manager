# Import Engine Plan Review — Iteration 1 (Opus)

## Critical Issues

### 1. relationship_types has no version_id column
Plan incorrectly implies version_id applies to all three tables. relationship_types has no version_id.
**Fix:** Explicitly note version_id only for classes and properties.

### 2. Existing Rust models lack source_id field
Class, Property, RelationshipType structs in ontology/models.rs don't have source_id. Adding is_system column will also break existing Class model.
**Fix:** Plan must include updating existing model structs.

### 3. is_system migration breaks existing Class model
Adding is_system BOOLEAN NOT NULL to classes means existing SELECT * with FromRow will fail.
**Fix:** Coordinate migration with model update.

### 4. Transaction boundary doesn't cover conflict detection + flag updates
Swap is in a transaction, but Detect and Finalize appear outside it. Half-success possible.
**Fix:** Entire flow must be one transaction per the spec's atomicity requirement.

## Significant Issues

### 5. Two services on one path prefix (different State types)
OntologySourceService and ImportService have different State types. Can't nest both under /api/ontology-sources without resolution.
**Fix:** Use .with_state() on each to produce Router<()>, then merge.

### 6. No validation that base exists before extension import
Conflict detection against base is meaningless if no base is imported.
**Fix:** Validate is_base=TRUE and imported_at IS NOT NULL before allowing extension import.

### 7. No cycle detection in topological sort
Cyclic parent references in source data would cause hang/panic.
**Fix:** Add cycle detection, return ParseError.

### 8. Duplicate names across sources — no downstream query guidance
Two sources can have classes with same name. Plan doesn't address how queries resolve this.
**Fix:** Document expected behavior for consumers.

## Moderate Issues

### 9. Property conflict detection requires cross-source class name JOIN
Properties use class_id FK, not class_name. Conflict detection needs a complex JOIN.

### 10. No source directory validation before file reads
Broken symlink gives IoError, not helpful message.

### 11. DELETE order inconsistency between plan and spec

### 12. No validation of orphan references in parsed data
Properties referencing non-existent classes should be caught before insert.

## Minor Issues

### 13-17. Various: no is_abstract for edge types, no concurrent import protection, tenant_id NULL uniqueness edge case.

## Recommendations
1. Fix critical issues before implementation
2. Write actual SQL for conflict detection queries
3. Add pre-import validation (no orphans, no cycles, no duplicates)
4. Consider ImportService taking OntologySourceService as dependency
5. Add test for re-importing base while extension exists
