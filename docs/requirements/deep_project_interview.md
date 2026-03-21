# Deep Project Interview: Runtime Ontology Switching

## Context
The ontology-manager currently has ontology data baked into SQL migrations. A new data source architecture (`data/sources.json` + manifest.json per source) has been established with two sources: system-ontology and mpcg-ontology. The goal is to enable runtime switching between ontology data sources.

## Research: Protege and Other Tools
Extensive research was conducted on Protege (Stanford ontology editor) and other ontology management tools. Key findings informing this design:

### Protege UX Patterns to Adopt
- **Master-detail tree with global selection** — click a class, all panels update
- **Hypertext cross-navigation** — click any entity reference to navigate to it
- **Asserted vs. inferred toggle** — distinguish explicit from computed
- **Color-coded relationship visualization** with filters
- **Render-by-label toggle** for human-readable display

### Protege Pain Points to Avoid
- **Active ontology confusion** — users accidentally edit the wrong ontology (tiny dropdown)
- **No persistent preferences** per ontology
- **Dated, overwhelming UI** for non-engineers
- **Plugin dependency** for key features (visualization)
- **Mangles ontology files** on round-trip

### Design Goal
Make a tool that is **way better and more intuitive** than Protege. Modern web UI, clear visual hierarchy, no confusion about what's active.

## Interview Decisions

### Q1: System ontology layer
**Decision:** Fully replaceable ontologies. No mandatory system layer. However, support **loading two ontologies** — one as base and another as extension on top. This enables the pattern where system-ontology is the base and a domain ontology extends it, but also allows loading any single ontology standalone.

### Q2: Load strategy
**Decision:** Import to database. Read the JSON/JSON-Schema files from the data source and insert into the existing PostgreSQL tables (classes, properties, relationship_types). This makes the imported ontology fully queryable and editable via the existing REST API and UI.

### Q3: UI placement
**Decision:** Both. A **quick-switch in the sidebar** workspace switcher for fast ontology source changes, plus a **dedicated /ontology-sources page** with cards showing stats, preview, format info, and activate/import actions.

### Q4: Master-detail browser
**Decision:** Yes, include a redesigned ontology browser with master-detail tree + detail panels as part of this feature. This is the Protege pattern that works well, adapted to a modern web UI.

### Q5: Conflict handling for layered ontologies
**Decision:** Show both definitions and flag the conflict with a visual indicator. User resolves manually. This preserves transparency about what each source contributes.

### Q6: Import reversibility
**Decision:** Clean swap. Each imported source gets a namespace/tag in the database so it can be fully identified and removed. Importing a new source replaces the previous import of that slot (base or extension) cleanly.

## Summary of Architecture

```
┌─────────────────────────────────────────────┐
│              ontology-manager               │
│                                             │
│  data/sources.json → discovers sources      │
│       ↓                                     │
│  /ontology-sources page → browse & import   │
│       ↓                                     │
│  Import Engine → reads JSON, adapts format  │
│       ↓                                     │
│  PostgreSQL (classes, properties, rels)      │
│  tagged with source_id for clean swap       │
│       ↓                                     │
│  Ontology Browser (master-detail tree)      │
│  with conflict indicators for layers        │
└─────────────────────────────────────────────┘
```
