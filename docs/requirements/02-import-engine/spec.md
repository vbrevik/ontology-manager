# 02: Import Engine

## Overview

Backend service that loads ontology data from a selected source into the PostgreSQL database. Supports multiple formats via adapters, clean swap for reversibility, and layering with conflict detection.

## Scope

### In Scope
- REST endpoint: `POST /api/ontology-sources/{id}/import` — import a source into the database
- REST endpoint: `DELETE /api/ontology-sources/{id}/import` — remove an imported source (clean swap out)
- Format adapter: **JSON adapter** — reads classes.json, properties.json, relationship_types.json
- Format adapter: **JSON Schema + Taxonomy adapter** — reads schema.json + taxonomy.json, maps to internal model
- Clean swap: remove all DB entries tagged with a source_id, then insert new ones (atomic transaction)
- Layering: import a second source as extension alongside a base, detect and flag conflicts
- Conflict detection: identify classes/properties with same name from different sources

### Out of Scope
- Source discovery and metadata (split 01)
- Frontend UI (splits 03, 04)
- Editing imported ontology data (future work)
- Real-time sync between files and database

## Technical Details

### Import Flow

```
POST /api/ontology-sources/{id}/import?role=base|extension
  │
  ├─ 1. Resolve source path from ontology_sources table
  ├─ 2. Read manifest.json → determine format
  ├─ 3. Dispatch to format adapter
  │     ├─ JSON adapter → read classes.json, properties.json, relationship_types.json
  │     └─ JSON Schema adapter → parse schema.json + taxonomy.json
  ├─ 4. If clean swap: DELETE FROM classes/properties/relationship_types WHERE source_id = {id}
  ├─ 5. INSERT new entries with source_id tag
  ├─ 6. If extension: run conflict detection against base
  ├─ 7. Update ontology_sources table (imported_at, is_base/is_extension)
  └─ 8. Return import result with stats and any conflicts
```

### Format Adapters

#### JSON Adapter (for system-ontology format)

Reads the flat JSON files directly:
- `classes.json` → maps each class entry to a `classes` table INSERT
- `properties.json` → maps each property group to `properties` table INSERTs
- `relationship_types.json` → maps each relationship type to `relationship_types` table INSERT

Field mapping:
```
classes.json class → classes table:
  name → name
  parent → parent_class_id (resolve by name)
  is_abstract → is_abstract
  is_system → is_system
  description → description
  source_id → {source_id}

properties.json property → properties table:
  class_name (key) → class_id (resolve by name + source_id)
  name → name
  type → data_type
  required → is_required
  description → description
  source_id → {source_id}

relationship_types.json type → relationship_types table:
  name → name
  description → description
  source_class → source_class_id (resolve by name)
  target_class → target_class_id (resolve by name)
  source_id → {source_id}
```

#### JSON Schema + Taxonomy Adapter (for MPCG format)

Parses the hierarchical type system:

1. Read `src/taxonomy.json` → extract `nodeTypes` tree
   - Each node type → a `classes` table entry
   - Parent-child in tree → parent_class_id relationship
   - Description from taxonomy → description

2. Read `src/taxonomy.json` → extract `edgeTypes` tree
   - Each edge type → a `relationship_types` table entry
   - Parent-child preserved

3. Read `src/schema.json` → extract `$defs.NodeType.enum` for active types
   - Only types in the enum are marked as active/non-abstract

4. Properties from schema's node definition → mapped to `properties` table

### Clean Swap

Atomic transaction:
```sql
BEGIN;
  DELETE FROM properties WHERE source_id = $1;
  DELETE FROM relationship_types WHERE source_id = $1;
  DELETE FROM classes WHERE source_id = $1;
  -- then INSERT new data
COMMIT;
```

This ensures no partial state. If anything fails, the entire import rolls back.

### Layering and Conflict Detection

When importing as `extension`:
1. Import proceeds normally (all entries tagged with extension's source_id)
2. After import, run conflict query:
```sql
SELECT base.name, base.source_id as base_source, ext.source_id as ext_source
FROM classes base
JOIN classes ext ON base.name = ext.name
WHERE base.source_id = $base_id AND ext.source_id = $ext_id;
```
3. Store conflicts in a `source_conflicts` table:
```sql
CREATE TABLE source_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_source_id TEXT NOT NULL,
    extension_source_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,  -- 'class', 'property', 'relationship_type'
    entity_name TEXT NOT NULL,
    resolution TEXT,            -- NULL = unresolved, 'base', 'extension'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### API Endpoints

#### `POST /api/ontology-sources/{id}/import`
Query params: `role=base|extension` (default: base)

Response:
```json
{
  "source_id": "mpcg-ontology",
  "role": "extension",
  "imported": {
    "classes": 20,
    "properties": 45,
    "relationship_types": 25
  },
  "conflicts": [
    {
      "type": "class",
      "name": "Context",
      "base_source": "system-ontology",
      "extension_source": "mpcg-ontology"
    }
  ],
  "imported_at": "2026-03-21T14:00:00Z"
}
```

#### `DELETE /api/ontology-sources/{id}/import`
Removes all entries tagged with this source_id. Returns count of removed entries.

### Backend Structure

```
backend/src/features/import_engine/
├── mod.rs              -- module declaration
├── models.rs           -- ImportResult, ConflictEntry types
├── service.rs          -- orchestrator: resolve → adapt → swap → detect
├── routes.rs           -- Axum route handlers
├── adapters/
│   ├── mod.rs          -- OntologyAdapter trait
│   ├── json_adapter.rs -- flat JSON format reader
│   └── schema_adapter.rs -- JSON Schema + taxonomy reader
└── conflict.rs         -- conflict detection and storage
```

## Constraints
- Import must be atomic (all-or-nothing via transaction)
- Must not modify external ontology data files (read-only)
- Must handle large ontologies (hundreds of classes) within 10 seconds
- Adapter trait must be extensible for future formats

## Dependencies
- Split 01: `ontology_sources` table, `source_id` columns, source resolution

## Deliverables
1. Database migration for `source_conflicts` table
2. OntologyAdapter trait with two implementations
3. Import/unload service with transaction management
4. Conflict detection logic
5. Two REST endpoints with tests
