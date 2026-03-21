# Runtime Ontology Switching

## Goal

Enable the ontology-manager to work with multiple ontology data sources, allowing users to browse available ontologies, select one as active, and have the tool load/display that ontology's classes, properties, and relationships.

## Current Architecture

The ontology-manager is a full-stack application:
- **Backend:** Rust/Axum with PostgreSQL (SQLx)
- **Frontend:** React 19 + TypeScript (Vite, TanStack Router/Query)
- **UI Components:** Shadcn/Radix + Tailwind CSS

### Data Source Pattern (already implemented)

```
ontology-manager/data/
├── sources.json              # Registry of available ontology sources
├── system-ontology/          # Symlink → ontology-data repo (JSON: classes, properties, relationships)
└── mpcg-ontology/            # Symlink → multi-perspective-context-ontology repo (JSON Schema + taxonomy)
```

Each source has a `manifest.json` with:
- `name`, `version`, `description`
- `type`: "ontology-data-source"
- `format`: "json" or "json-schema"
- `domain`: what domain it covers
- `files`: map of file roles to paths
- `stats`: counts of classes/types/etc.

### Two existing ontology data sources

1. **system-ontology** (format: json): 38 classes, 170+ properties, 19 relationship types — platform operations (AccessControl, Identity, Operations, Monitoring)
2. **mpcg-ontology** (format: json-schema): 20 node types, 25 edge types, 70 scenarios — universal context representation with perspective tagging

### Current ontology in the tool

The ontology-manager currently loads its ontology from SQL migrations baked into the backend. Classes, properties, and relationship types are stored in PostgreSQL tables (`classes`, `properties`, `relationship_types`, `entities`, `relationships`).

The frontend has features for browsing and editing ontology classes, properties, and relationships via REST API endpoints.

## Requirements

### R1: Source Discovery API
Backend endpoint that reads `data/sources.json` and each source's `manifest.json`, returning a list of available ontology data sources with their metadata.

### R2: Source Switching UI
Frontend component (likely in the existing context/workspace switcher area) that displays available ontology sources and lets the user select one as active.

### R3: Source Loading
When a source is selected, the backend loads its ontology data into the existing database schema (classes, properties, relationship_types tables) — either replacing or namespacing alongside the current system ontology.

### R4: Format Adaptation
The two sources use different formats (flat JSON vs JSON Schema + taxonomy). The loader needs format-specific adapters to normalize both into the tool's internal schema.

### R5: Active Source Persistence
The currently selected source should persist across sessions (stored in DB or config).

## Constraints

- The existing SQL migrations and system ontology must continue to work — system classes (User, Role, Permission, etc.) are required for the tool to function
- The tool's existing ontology UI (class browser, property editor, relationship viewer) should work with any loaded ontology
- No changes to the external ontology data repos (ontology-data, multi-perspective-context-ontology)
- Must handle the case where a symlinked data source is unavailable (graceful degradation)

## Non-Goals

- Real-time sync between data source files and the database
- Editing external ontology sources through the tool (read-only import)
- Merging multiple ontologies into one view (one active source at a time, plus system)
