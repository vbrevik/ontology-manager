# Import Engine — Complete Specification

## Overview

Backend service that loads ontology data from a selected source into the PostgreSQL database. Supports two formats via adapters (JSON and JSON Schema + Taxonomy), clean swap for reversibility, and layering with automatic conflict detection.

## Scope

### In Scope
- `POST /api/ontology-sources/{id}/import?role=base|extension` — import a source
- `DELETE /api/ontology-sources/{id}/import` — remove imported data + clear flags
- JSON adapter for system-ontology format (classes.json, properties.json, relationship_types.json)
- JSON Schema + Taxonomy adapter for MPCG format (schema.json, taxonomy.json)
- Clean swap: atomic DELETE + INSERT within a transaction
- Layering: import extension source alongside base, auto-detect conflicts
- Conflict storage in `source_conflicts` table
- Database migration: add `is_system` column to `classes` table, create `source_conflicts` table

### Out of Scope
- Seed data import (entities, permissions, rate limit rules)
- Frontend UI
- Editing imported data
- Real-time file-to-DB sync
- Background/async import (synchronous is sufficient)
- Entity reference handling during clean swap (not applicable yet)

## Database Requirements

### Existing Tables (from split-01)
- `classes` — has `source_id TEXT`, `parent_class_id UUID`, `version_id UUID`, `is_abstract BOOLEAN`
- `properties` — has `source_id TEXT`, `class_id UUID`, `data_type VARCHAR(50)`, `is_required`, `is_unique`, `is_sensitive`
- `relationship_types` — has `source_id TEXT`, `allowed_source_class_id UUID`, `allowed_target_class_id UUID`
- `ontology_sources` — has `source_id TEXT UNIQUE`, `imported_at TIMESTAMPTZ`, `is_base`, `is_extension`, `format TEXT`

### New Migration Required
1. Add `is_system BOOLEAN NOT NULL DEFAULT FALSE` to `classes` table
2. Create `source_conflicts` table:
   - `id UUID PRIMARY KEY`
   - `base_source_id TEXT NOT NULL`
   - `extension_source_id TEXT NOT NULL`
   - `entity_type TEXT NOT NULL` — 'class', 'property', 'relationship_type'
   - `entity_name TEXT NOT NULL`
   - `resolution TEXT` — NULL = unresolved, 'base', 'extension'
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### Insert Constraints
- All imported rows require `version_id` — use current version from `ontology_versions WHERE is_current = TRUE`
- `tenant_id` should be NULL for imported data (shared across tenants)
- `source_id` must be set on all imported rows (matches the source's source_id)
- Unique constraints are partial indexes:
  - Built-in: `(name, tenant_id, version_id)` WHERE source_id IS NULL
  - Imported: `(name, tenant_id, version_id, source_id)` WHERE source_id IS NOT NULL

### Insert Order (referential integrity)
1. Classes (parents before children — topological sort on parent references)
2. Properties (need class_id FK)
3. Relationship types (need source/target class_id FKs)

### Delete Order (clean swap)
1. Properties (FK to classes)
2. Relationship types (FK to classes)
3. Classes

## Format: JSON (system-ontology)

### classes.json
```json
{"classes": [
  {"name": "Role", "parent": "AccessControl", "is_abstract": false, "is_system": true, "description": "..."}
]}
```
- `parent` is a **string name**, not UUID — must resolve to `parent_class_id` by name lookup
- `is_system` maps to new `is_system` column
- 31 classes in current system-ontology

### properties.json
```json
{"properties": {
  "ClassName": [
    {"name": "username", "type": "string", "required": true, "unique": true, "sensitive": true, "description": "..."}
  ]
}}
```
- Keyed by class name — must resolve to `class_id` by name + source_id
- `type` maps to `data_type` column
- `required` → `is_required`, `unique` → `is_unique`, `sensitive` → `is_sensitive`
- Optional fields: `description`, `level`, `enum` (store in `validation_rules` JSONB)
- 170 properties in current system-ontology

### relationship_types.json
```json
{"relationship_types": [
  {"name": "has_role", "description": "...", "source_class": "User", "target_class": "Role",
   "cardinality": "many:one", "grants_permission_inheritance": true}
]}
```
- `source_class`/`target_class` are **string names** — resolve to `allowed_source_class_id`/`allowed_target_class_id`
- `cardinality` format: "many:one" → split into `source_cardinality`/`target_cardinality`
- 19 relationship types in current system-ontology

## Format: JSON Schema + Taxonomy (MPCG)

### Manifest files map
- `"schema": "src/schema.json"` — JSON Schema 2020-12 with `$defs`
- `"taxonomy": "src/taxonomy.json"` — hierarchical type tree

### src/taxonomy.json → Classes
```json
{"nodeTypes": {
  "Entity": {
    "description": "...",
    "subtypes": {
      "Agent": {"description": "...", "subtypes": {
        "Person": {"description": "..."},
        "Organization": {"description": "...", "subtypes": {...}}
      }}
    }
  }
}}
```
- Recursive tree structure — each key is a class name, nested `subtypes` define children
- **Import ALL types** from taxonomy (not just enum-listed ones)
- Types NOT in schema.json's `$defs.NodeType.enum` → mark as `is_abstract = true`
- Types IN the enum → `is_abstract = false`
- 90+ node types become classes
- Parent-child via `subtypes` nesting → `parent_class_id` FK

### src/taxonomy.json → Relationship Types
```json
{"edgeTypes": {
  "Causal": {"description": "...", "subtypes": {
    "causes": {"description": "..."},
    "enables": {"description": "..."}
  }}
}}
```
- Same recursive structure as nodeTypes
- 25+ edge types become relationship_types
- Types NOT in `$defs.EdgeType.enum` are abstract categories

### Property Extraction from Taxonomy
Some taxonomy entries have `property_descriptions`:
```json
{"Affiliation": {
  "description": "...",
  "property_descriptions": {
    "hostility_status": "Constrained vocabulary: FRIENDLY, HOSTILE, NEUTRAL, UNKNOWN, ..."
  }
}}
```
- Import as `properties` rows on the corresponding class
- `data_type` = "string" (default for taxonomy properties)
- Store enum constraints in `validation_rules` JSONB if vocabulary is constrained

### src/schema.json → Active Type Determination
- `$defs.NodeType.enum` = list of active node type names
- `$defs.EdgeType.enum` = list of active edge type names
- Used to set `is_abstract` flag during import

## API Endpoints

### POST /api/ontology-sources/{id}/import
**Query params:** `role=base|extension` (default: base)
**Auth:** JWT required
**Behavior:**
1. Resolve source from `ontology_sources` table by source_id
2. Read manifest.json from source path → determine format
3. Dispatch to format adapter
4. If clean swap (source already imported): DELETE existing rows with this source_id
5. INSERT new data with source_id tag
6. If role=extension: run conflict detection against current base source
7. Update `ontology_sources`: set `imported_at = NOW()`, set `is_base`/`is_extension` flag
8. Return import result with stats and any conflicts

**Response (200):**
```json
{
  "source_id": "mpcg-ontology",
  "role": "extension",
  "imported": {"classes": 90, "properties": 15, "relationship_types": 25},
  "conflicts": [{"type": "class", "name": "Context", "base_source": "system-ontology", "extension_source": "mpcg-ontology"}],
  "imported_at": "2026-03-21T14:00:00Z"
}
```

**Errors:** 404 (source not found), 400 (invalid role, source unavailable), 500 (import failed — rolled back)

### DELETE /api/ontology-sources/{id}/import
**Auth:** JWT required
**Behavior:**
1. Delete properties WHERE source_id = {id}
2. Delete relationship_types WHERE source_id = {id}
3. Delete classes WHERE source_id = {id}
4. Delete source_conflicts WHERE base_source_id = {id} OR extension_source_id = {id}
5. Clear is_base/is_extension flags on the ontology_sources row
6. Set imported_at = NULL
7. All within a single transaction

**Response (200):**
```json
{
  "source_id": "system-ontology",
  "removed": {"classes": 31, "properties": 170, "relationship_types": 19}
}
```

## Conflict Detection

When importing with `role=extension`, after successful import:
1. Query classes with same name in both base and extension sources
2. Query properties with same name on same-named classes across sources
3. Query relationship_types with same name across sources
4. Store each conflict in `source_conflicts` table
5. Return conflicts in the import response

## Constraints
- Import must be atomic (all-or-nothing via transaction)
- Must not modify external ontology data files (read-only)
- Must handle ontologies with hundreds of classes within request timeout
- Adapter selection must be extensible for future formats
- Synchronous request-response (no background jobs)
