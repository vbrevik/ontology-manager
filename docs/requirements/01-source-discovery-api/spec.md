# 01: Source Discovery API

## Overview

Backend service and API endpoints for discovering available ontology data sources, tracking which source each ontology entry came from, and persisting the active source selection.

## Scope

### In Scope
- REST endpoint: `GET /api/ontology-sources` — returns list of available sources with metadata
- REST endpoint: `GET /api/ontology-sources/active` — returns the currently active source(s)
- REST endpoint: `PUT /api/ontology-sources/active` — set the active source (base and optional extension)
- Database migration: add `source_id` column to `classes`, `properties`, `relationship_types` tables
- Database migration: create `ontology_sources` table for tracking imported sources and active state
- File system reader: parse `data/sources.json` and resolve each source's `manifest.json`
- Graceful handling of missing/broken symlinks (source listed but directory unavailable)

### Out of Scope
- Importing ontology data into the database (split 02)
- Frontend UI for source management (splits 03, 04)
- Modifying external ontology data repositories

## Technical Details

### Database Schema Changes

#### New table: `ontology_sources`
```sql
CREATE TABLE ontology_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL UNIQUE,        -- matches sources.json id (e.g., "system-ontology")
    name TEXT NOT NULL,                     -- from manifest.json
    description TEXT,                       -- from manifest.json
    version TEXT,                           -- from manifest.json
    format TEXT NOT NULL,                   -- "json" or "json-schema"
    domain TEXT,                            -- from manifest.json
    path TEXT NOT NULL,                     -- resolved filesystem path
    is_base BOOLEAN NOT NULL DEFAULT FALSE, -- is this the active base ontology?
    is_extension BOOLEAN NOT NULL DEFAULT FALSE, -- is this an active extension?
    imported_at TIMESTAMPTZ,               -- when last imported (NULL = never)
    stats JSONB,                           -- from manifest.json stats
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Column additions
```sql
ALTER TABLE classes ADD COLUMN source_id TEXT;
ALTER TABLE properties ADD COLUMN source_id TEXT;
ALTER TABLE relationship_types ADD COLUMN source_id TEXT;
```

The `source_id` column is nullable — existing data from SQL migrations gets `NULL` (treated as "built-in"). Imported data gets tagged with the source's id string.

### API Endpoints

#### `GET /api/ontology-sources`
Returns all discoverable sources from `data/sources.json`, enriched with manifest data and import status.

Response:
```json
{
  "sources": [
    {
      "id": "system-ontology",
      "name": "ontology-manager-system",
      "description": "System ontology for the ontology-manager platform...",
      "version": "1.0.0",
      "format": "json",
      "domain": "platform-operations",
      "available": true,
      "imported_at": "2026-03-21T13:00:00Z",
      "is_base": true,
      "is_extension": false,
      "stats": { "classes": 38, "properties": 170, "relationship_types": 19 }
    },
    {
      "id": "mpcg-ontology",
      "name": "multi-perspective-context-ontology",
      "description": "A typed property graph ontology...",
      "version": "2.0.0",
      "format": "json-schema",
      "domain": "universal-context",
      "available": true,
      "imported_at": null,
      "is_base": false,
      "is_extension": false,
      "stats": { "node_types": 20, "edge_types": 25, "scenarios": 70 }
    }
  ]
}
```

When a symlink is broken or directory missing, `available: false` with no error — graceful degradation.

#### `GET /api/ontology-sources/active`
Returns the currently active base and extension sources.

#### `PUT /api/ontology-sources/active`
Sets the active source configuration. Body:
```json
{
  "base": "system-ontology",
  "extension": "mpcg-ontology"  // optional, null to clear
}
```

This endpoint only updates the `is_base`/`is_extension` flags. Actual import is triggered by split 02's endpoints.

### File System Reader

The source discovery service:
1. Reads `data/sources.json` from the configured data directory
2. For each source entry, resolves the path and checks if directory exists
3. If directory exists, reads `manifest.json` and extracts metadata
4. Cross-references with `ontology_sources` table for import status
5. Returns combined result

The data directory path should be configurable via environment variable `ONTOLOGY_DATA_DIR` (default: `./data`).

### Backend Structure

```
backend/src/features/ontology_sources/
├── mod.rs          -- module declaration
├── models.rs       -- OntologySource struct, API request/response types
├── service.rs      -- file system reader, source resolution logic
└── routes.rs       -- Axum route handlers
```

## Constraints
- Must not modify existing migration files
- `source_id` column must be nullable to preserve existing data
- Must handle any number of sources (not hardcoded to 2)
- Source discovery must complete within 1 second even if some symlinks are broken

## Dependencies
- None (this is the foundational split)

## Deliverables
1. Database migration adding `ontology_sources` table and `source_id` columns
2. Source discovery service (file reader + DB sync)
3. Three REST endpoints with tests
4. Integration with existing Axum router
