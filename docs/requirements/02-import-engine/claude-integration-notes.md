# Integration Notes — Opus Review Feedback

## Integrating (Critical + Significant)

### 1. relationship_types has no version_id ✅
Correct. Will update plan to note version_id only for classes and properties.

### 2-3. Existing models need source_id + is_system ✅
Correct. Plan must include updating Class, Property, RelationshipType structs in ontology/models.rs. This is a prerequisite step.

### 4. Transaction must cover entire flow ✅
Correct. The entire import (delete + insert + conflict detect + flag update) must be one transaction.

### 5. Routing: two State types under same prefix ✅
Correct. Will document the merge strategy: both routers call `.with_state()` to produce `Router<()>`, then merge.

### 6. Validate base exists before extension import ✅
Good catch. Will add validation step.

### 7. Cycle detection in topological sort ✅
Good catch. Will add cycle detection returning ParseError.

### 9. Property conflict detection SQL ✅
Will add the cross-source JOIN query.

### 12. Validate orphan references in parsed data ✅
Will add pre-insert validation step.

## Integrating (Moderate/Minor)

### 10. Source directory validation ✅
Will add path validation before file reads.

### 11. DELETE order alignment ✅
Will align plan with spec order.

## NOT Integrating

### 8. Downstream query guidance for duplicate names
Deferred — this is a consumer concern, not an import engine concern. The import engine correctly stores data with source_id tags. How downstream queries handle it is a future concern (likely in split-03 ontology browser).

### 13. No queries.rs file
Acceptable divergence. conflict.rs is a better name for the module.

### 14. No validation_rules schema
Acceptable for now. JSONB is flexible by design.

### 15. Concurrent import protection
Low risk for current scale. Transaction isolation handles most cases. Can add advisory lock later.

### 16. is_abstract for relationship types
The DB has no is_abstract column for relationship_types. Adding one is out of scope for this split. Abstract edge type categories from MPCG will be imported as regular relationship types — they can be filtered by naming convention if needed.

### 17. tenant_id NULL uniqueness
Acceptable risk — source data files don't have duplicates. Pre-insert validation (item 12) covers this.

### Recommendation 4: ImportService taking OntologySourceService as dependency
Not integrating. ImportService needs the pool and data_dir, which it already has. Manifest reading is simple enough to not warrant a service dependency. Keeping services independent follows the existing codebase pattern.
