# Source Discovery API — Complete Specification

## What We're Building

A backend feature module (`ontology_sources`) for the ontology-manager that enables discovering, tracking, and managing ontology data sources stored on the filesystem.

## Requirements

### R1: Source Discovery
- Read `data/sources.json` to discover configured ontology data sources
- For each source, resolve the filesystem path and read its `manifest.json`
- Handle broken symlinks gracefully (`available: false`, no error)
- Return enriched source list combining filesystem metadata with database import status
- Data directory path configurable via `ONTOLOGY_DATA_DIR` env var (default: `./data`)

### R2: Database Schema Changes
- Add `source_id TEXT` nullable column to `classes`, `properties`, `relationship_types` tables
- Update unique constraint on `classes` from `(name, tenant_id, version_id)` to `(name, tenant_id, version_id, source_id)` — enables same class name from different sources (layering)
- Create `ontology_sources` table tracking discovered and imported sources
- Each import creates an `ontology_versions` entry like `{source_id}@{version}` for clean tracking

### R3: API Endpoints (all require authentication)
1. `GET /api/ontology-sources` — list all discoverable sources with metadata and import status
2. `GET /api/ontology-sources/active` — return currently active base and extension sources
3. `PUT /api/ontology-sources/active` — set active base and optional extension source

### R4: Source Metadata Model
From `manifest.json`:
- `name`, `version`, `description` — display info
- `type` — always "ontology-data-source"
- `format` — "json" or "json-schema" (determines which import adapter to use later)
- `domain` — what domain the ontology covers
- `files` — map of file roles to relative paths
- `stats` — counts (classes, properties, etc.)

### R5: Active Source Persistence
- `ontology_sources` table tracks `is_base` and `is_extension` flags
- At most one source can be `is_base = true`, at most one `is_extension = true`
- Setting a new active source clears the previous flag (atomic update)
- Source activation is separate from import (split 02 handles actual data loading)

## Constraints
- All endpoints require JWT authentication (consistent with existing patterns)
- Must follow existing feature module pattern: `mod.rs` → `models.rs` → `service.rs` → `routes.rs`
- Must use `thiserror` for error enum with `IntoResponse` implementation
- `source_id` column nullable — existing data gets `NULL` (treated as "built-in")
- Source discovery must complete within 1 second even with broken symlinks
- Must handle any number of sources (not hardcoded to current 2)

## Non-Goals
- Importing ontology data into DB (split 02)
- Frontend UI (splits 03, 04)
- Modifying external ontology repos
- Creating/deleting sources via API (manual symlink setup)
