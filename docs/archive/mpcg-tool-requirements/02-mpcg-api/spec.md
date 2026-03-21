# 02-mpcg-api — REST API Server Spec

## Overview

A lightweight Node.js REST API that reads MPCG project files and serves them to the web frontend. Thin layer over `@mpcg/core`.

## Endpoints

### Taxonomy & Schema

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/taxonomy` | Full taxonomy tree (from taxonomy.json) |
| GET | `/api/schema` | Full JSON Schema (from schema.json) |
| GET | `/api/types/nodes` | Flat list of node types with descriptions |
| GET | `/api/types/edges` | Flat list of edge types with descriptions |
| GET | `/api/types/search?q=belief` | Search types by name or description |

### Scenarios

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/scenarios` | List all scenarios (id, group, subgroup, entity/relationship counts) |
| GET | `/api/scenarios/:id` | Full scenario with description, expected_entities, expected_relationships |
| GET | `/api/scenarios/groups` | Group/subgroup hierarchy |

### Validation

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/validate` | `{ graph: MPCGGraphInput }` | `{ valid, errors, warnings, stats }` |

### Graph Operations

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/graph/load` | `{ graph: MPCGGraphInput }` | `{ id, stats }` (loads into server memory) |
| GET | `/api/graph/:id/stats` | — | Node/edge counts, type distributions |
| GET | `/api/graph/:id/contradictions` | — | All contradiction pairs |
| GET | `/api/graph/:id/beliefs/:agentId` | — | Beliefs held by agent |
| GET | `/api/graph/:id/provenance/:nodeId` | — | Sources, evidence, assertors |
| GET | `/api/graph/:id/causal-chain/:nodeId` | — | Causal chain from node |
| GET | `/api/graph/:id/visible?classification=HEMMELIG` | — | Nodes visible at clearance level |

### Formal Constraints

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/constraints/domain-range` | Domain/range rules for all edge types |
| GET | `/api/constraints/algebra` | Transitivity, symmetry, inverse pairs |

## Implementation

- **Framework:** Express.js or Fastify
- **Data source:** Reads `src/schema.json`, `src/taxonomy.json`, `src/scenarios/` directly from the project directory
- **Graph storage:** In-memory Map of loaded graphs (no persistence needed)
- **Imports:** Uses `@mpcg/core` for validate() and MPCGGraph

## Server Structure

```
packages/api/
├── package.json
├── server.js         ← Entry point, Express app
├── routes/
│   ├── taxonomy.js   ← /api/taxonomy, /api/types/*
│   ├── scenarios.js  ← /api/scenarios/*
│   ├── validate.js   ← /api/validate
│   ├── graph.js      ← /api/graph/*
│   └── constraints.js← /api/constraints/*
└── tests/
    └── api.test.js   ← Endpoint tests
```

## Configuration

- `MPCG_PROJECT_DIR` — path to the MPCG project root (defaults to `../../`)
- `PORT` — server port (defaults to 3001)

## CORS

Enable CORS for `localhost:5173` (Vite dev server default).

## Success Criteria

1. `npm start` launches the API on localhost:3001
2. `GET /api/taxonomy` returns the full type hierarchy
3. `POST /api/validate` with a valid graph returns `{ valid: true }`
4. `POST /api/validate` with an invalid graph returns errors
5. Graph queries return correct results against loaded graphs
