# Import Engine Usage Guide

## Overview

The import engine reads ontology source files (JSON or JSON Schema + Taxonomy format), validates them, and loads them into the database as classes, properties, and relationship types. It supports base and extension sources with conflict detection.

## API Endpoints

### Import a Source

```
POST /api/ontology-sources/:source_id/import?role=base
POST /api/ontology-sources/:source_id/import?role=extension
```

**Parameters:**
- `source_id` — The source_id from the ontology_sources table
- `role` — `"base"` (default) or `"extension"`

**Response (200):**
```json
{
  "source_id": "system-ontology",
  "role": "base",
  "imported": {
    "classes": 15,
    "properties": 42,
    "relationship_types": 8
  },
  "conflicts": [],
  "imported_at": "2026-03-21T18:30:00Z"
}
```

**Errors:**
- `404` — Source not found in ontology_sources
- `400` — Invalid role, extension without base, parse errors
- `500` — IO or database errors

### Unload a Source

```
DELETE /api/ontology-sources/:source_id/import
```

**Response (200):**
```json
{
  "source_id": "system-ontology",
  "removed": {
    "classes": 15,
    "properties": 42,
    "relationship_types": 8
  }
}
```

## Supported Formats

### JSON Format (`"json"`)
System-ontology format with three files:
- `classes.json` — `{"classes": [...]}`
- `properties.json` — `{"properties": {"ClassName": [...]}}`
- `relationship_types.json` — `{"relationship_types": [...]}`

### JSON Schema + Taxonomy Format (`"json-schema"`)
MPCG format with two files:
- `taxonomy.json` — Hierarchical nodeTypes/edgeTypes tree
- `schema.json` — JSON Schema with `$defs.NodeType.enum` and `$defs.EdgeType.enum`

## Behavior

### Clean Swap
Re-importing a source deletes all existing data for that source_id and inserts fresh data. No upsert logic.

### Base/Extension Model
- Only one base and one extension source can be active at a time
- Importing a new base clears the previous base's data and flags
- Extension import requires a base to be imported first
- Conflicts between base and extension are detected and stored in `source_conflicts`

### Validation
Before import, the parsed data is validated for:
- Duplicate class names
- Orphan parent class references
- Orphan property→class references
- Orphan relationship type→class references
- Class hierarchy cycles (topological sort)

## Architecture

```
routes.rs → service.rs → adapters/ → models.rs
                ↓
          database (transaction)
```

- **models.rs** — Intermediate representation, API types, error enum
- **adapters/** — Format-specific parsers + validation/sort
- **service.rs** — Orchestration (resolve, adapt, validate, swap, detect, finalize)
- **routes.rs** — Thin HTTP handlers
