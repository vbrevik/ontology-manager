<!-- SPLIT_MANIFEST
01-source-discovery-api
02-import-engine
03-ontology-browser
04-source-management-ui
END_MANIFEST -->

# Project Manifest: Runtime Ontology Switching

## Overview

This project enables the ontology-manager to work with multiple ontology data sources. Users can browse available ontologies, import them into the database, layer them (base + extension), and browse the loaded ontology with a modern master-detail tree interface inspired by — but far surpassing — Protege.

## Split Structure

### 01-source-discovery-api
**Backend endpoint** that reads `data/sources.json` and each source's `manifest.json`, returning available ontology data sources with metadata. Also adds a `source_id` tag column to the existing `classes`, `properties`, and `relationship_types` tables to track which source each entry came from. Includes the active source persistence (which source is loaded, stored in a config table).

**Dependencies:** None (foundational)

### 02-import-engine
**Backend service** that loads ontology data from a selected source into the PostgreSQL database. Handles two formats:
- **JSON format** (system-ontology): reads classes.json, properties.json, relationship_types.json directly
- **JSON Schema + taxonomy format** (mpcg-ontology): parses schema.json and taxonomy.json, maps node types → classes, edge types → relationship types

Supports **clean swap** (remove all entries tagged with a source_id, then insert new ones) and **layering** (import a second source as extension, flag conflicts where both sources define the same class).

**Dependencies:** 01-source-discovery-api (needs source_id tagging and discovery)

### 03-ontology-browser
**Frontend redesign** of the ontology browsing experience. Master-detail layout:
- **Left panel:** Collapsible tree hierarchy of classes (Protege's best pattern)
- **Right panel:** Detail view with properties, relationships, description, source indicator
- **Global selection:** Click a class anywhere, all panels update
- **Hypertext navigation:** Click any class/type reference to navigate to it
- **Source indicators:** Visual tags showing which source each class comes from
- **Conflict indicators:** When layered, flag classes defined in both base and extension
- **Color-coded relationships:** Filterable relationship visualization

Key UX improvements over Protege:
- Modern web UI, not a Java desktop app
- Clear visual distinction between sources (not a tiny dropdown)
- No accidental editing of wrong ontology — source ownership is always visible
- Responsive, fast — no 70-minute load times

**Dependencies:** 01-source-discovery-api (source metadata), 02-import-engine (loaded data)

### 04-source-management-ui
**Two frontend components:**
1. **Sidebar quick-switch:** Extend the existing workspace/context switcher to show active ontology source with one-click switching
2. **/ontology-sources page:** Full management page with cards for each available source showing name, description, stats, format, active/inactive status. Import, swap, layer, and remove actions.

**Dependencies:** 01-source-discovery-api (source listing), 02-import-engine (import actions), 03-ontology-browser (the browser it loads into)

## Execution Order

```
01-source-discovery-api  ──→  02-import-engine  ──→  03-ontology-browser
                                                           │
                                                           ↓
                                                  04-source-management-ui
```

1. **01-source-discovery-api** — Build first. Foundational DB schema changes + API.
2. **02-import-engine** — Build second. Needs source_id infrastructure from 01.
3. **03-ontology-browser** — Build third. The core UX — needs data loaded to display.
4. **04-source-management-ui** — Build last. Orchestrates all other pieces.

## Cross-Cutting Concerns

- **Source tagging in DB:** All splits depend on `source_id` being added to ontology tables (done in 01)
- **Format adapters:** The import engine (02) needs adapters per format. New ontology formats in the future means new adapters.
- **Existing UI compatibility:** The current ontology features (class editor, property editor) must continue working. The browser (03) enhances, not replaces, the existing views.

## Research-Informed Design Decisions

From Protege and competitive analysis:
- **Master-detail tree** (Protege's best UX pattern) → adopted in 03
- **VOWL-inspired color coding** (WebVOWL) → adopted in 03 for relationship viz
- **Clean source separation** (avoiding Protege's "active ontology confusion") → central to all splits
- **Git-style clean swap** (inspired by Mobi's versioning) → adopted in 02
- **UML-style property display** (OWLGrEd) → properties shown inside class detail panels in 03

## Commands

```bash
/deep-plan @01-source-discovery-api/spec.md
/deep-plan @02-import-engine/spec.md
/deep-plan @03-ontology-browser/spec.md
/deep-plan @04-source-management-ui/spec.md
```
