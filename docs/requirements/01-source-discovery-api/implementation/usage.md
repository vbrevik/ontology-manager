# Source Discovery API — Usage Guide

## Quick Start

The Source Discovery API is available at `/api/ontology-sources` (requires JWT auth).

### Configuration

Set `ontology_data_dir` in `config/default.toml` or via `APP_ONTOLOGY_DATA_DIR` env var:

```toml
ontology_data_dir = "./data"
```

### Data Directory Structure

```
data/
├── sources.json              # Lists available ontology sources
├── mpcg-ontology/            # Source directory
│   ├── manifest.json         # Source metadata
│   ├── classes.json
│   └── properties.json
└── custom-extension/         # Another source (can be symlink)
    ├── manifest.json
    └── classes.json
```

### sources.json Format

```json
{
  "description": "Available ontology data sources",
  "sources": [
    {
      "id": "mpcg-ontology",
      "path": "./mpcg-ontology",
      "description": "MPCG base ontology",
      "active": true
    }
  ]
}
```

### manifest.json Format

```json
{
  "name": "MPCG Ontology",
  "version": "2.0.0",
  "description": "Multi-perspective context ontology",
  "type": "ontology-data-source",
  "format": "json",
  "domain": "military",
  "files": {
    "classes": "classes.json",
    "properties": "properties.json"
  },
  "stats": { "classes": 42, "properties": 128 }
}
```

## API Endpoints

All endpoints require `Authorization: Bearer <JWT>` header.

### GET /api/ontology-sources

Discovers and returns all active sources from the filesystem. Syncs found sources to the database.

**Response:** `200 OK` with `Vec<SourceResponse>`

### GET /api/ontology-sources/active

Returns the currently active base and extension sources.

**Response:** `200 OK` with `ActiveSourcesResponse { base, extension }`

### PUT /api/ontology-sources/active

Sets which source is the active base and/or extension.

**Request body:**
```json
{
  "base": "mpcg-ontology",
  "extension": "custom-extension"
}
```

**Response:** `200 OK` with updated `ActiveSourcesResponse`

**Errors:**
- `404` if source_id not found in database
- `400` if same source_id used for both base and extension

## Running Tests

```sh
# All ontology_sources unit tests (no DB required)
cargo test --lib ontology_sources

# Integration tests (requires PostgreSQL)
cargo test --test ontology_sources_test
```
