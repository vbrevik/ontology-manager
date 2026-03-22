# MPCG Platform — Project Manifest

## Project Overview

Build a platform for visualizing, testing, and reusing the Multi-Perspective Context Graph (MPCG) ontology. Three components: an npm package (library), an API server (data layer), and a web app (UI).

## Splits

### 01-mpcg-package
**Publishable npm package** wrapping the existing schema, taxonomy, validator, and graph engine into an importable module.

- Exports: schema.json, taxonomy.json, validate(), MPCGGraph class, type definitions
- Zero runtime dependencies beyond what exists
- TypeScript type definitions for all node/edge types
- Works as `import { validate, MPCGGraph } from '@mpcg/core'`
- Tests: existing 22 tests + package import tests

### 02-mpcg-api
**Node.js REST API server** that reads MPCG project files and serves them to the frontend.

- Endpoints: GET /taxonomy, GET /schema, GET /scenarios, POST /validate, POST /query
- Reads directly from project files (no database)
- Uses 01-mpcg-package for validation and queries
- Handles graph loading, validation, and query execution server-side
- Tests: API endpoint tests

### 03-mpcg-web
**React + Vite web application** with five features:

1. **Taxonomy Browser** — interactive tree view of node/edge type hierarchy with descriptions, search, filtering
2. **Graph Visualizer** — paste or load an MPCG graph, render as interactive force-directed or hierarchical graph with type-colored nodes
3. **Live Validator** — real-time validation as you edit/paste graph JSON, showing errors and warnings inline
4. **Query Interface** — run predefined and custom queries against loaded graphs (contradictions, provenance, causal chains, beliefs by agent)
5. **Scenario Browser** — browse all 56 test scenarios, view expected types and relationships, load into visualizer

- Consumes 02-mpcg-api via REST
- Security label awareness (show/hide nodes based on simulated clearance level)
- Tests: component tests + E2E

## Dependencies

<!-- SPLIT_MANIFEST
01-mpcg-package
02-mpcg-api
03-mpcg-web
END_MANIFEST -->

## Execution Order

1. **01-mpcg-package** first — foundation, no dependencies
2. **02-mpcg-api** second — depends on package
3. **03-mpcg-web** third — depends on API

Splits 01 and 02 are relatively small (packaging existing code + thin API layer). Split 03 is the largest (5 UI features).

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Graph visualization performance with large graphs | Use WebGL-based renderer (react-force-graph), limit initial render to 500 nodes |
| TypeScript type generation from JSON Schema | Use json-schema-to-typescript or manual type definitions |
| API server blocking on large graph validation | Run validation async, stream results |
