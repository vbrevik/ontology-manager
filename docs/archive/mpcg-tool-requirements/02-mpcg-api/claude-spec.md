# MPCG REST API — Synthesized Requirements

## Overview

A lightweight Node.js REST API server that wraps `@mpcg/core` and serves MPCG data to the web frontend (`localhost:5173`). The API is a thin layer — it delegates all graph validation, querying, and type operations to the core library.

**Key decisions:**
- Framework: Express.js
- Data source: `@mpcg/core` exports for schema/taxonomy; filesystem for scenarios
- Graph storage: In-memory `Map` (no eviction, no persistence)
- Graph IDs: Use the graph's own `graph.id` field as the store key
- Auth: None — local development tool only
- Error format: RFC 7807 Problem Details (`{ type, title, status, detail }`)

---

## Endpoints

### Taxonomy & Schema

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/taxonomy` | Full taxonomy tree (from `@mpcg/core` taxonomy export) |
| GET | `/api/schema` | Full JSON Schema (from `@mpcg/core` schema export) |
| GET | `/api/types/nodes` | Flat list of node types with descriptions from taxonomy |
| GET | `/api/types/edges` | Flat list of edge types with descriptions from taxonomy |
| GET | `/api/types/search?q=<term>` | Search types by name or description — searches both node and edge types, matching against both type names and taxonomy descriptions |

### Scenarios

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/scenarios` | List all scenarios (id, group, subgroup, entity/relationship counts) |
| GET | `/api/scenarios/:id` | Full scenario with constructed MPCG graph |
| GET | `/api/scenarios/groups` | Group/subgroup hierarchy (from `_groups.json`) |

**Scenario graph construction:** The scenario files contain `expected_entities` (label + type) and `expected_relationships` (source label + target label + type). The API must construct valid MPCG graphs from these:
- Auto-generate UUIDs for each node
- Use entity labels as node labels
- Resolve edge source/target by matching node labels
- Auto-generate a graph UUID
- The constructed graph should pass `validate()`

### Validation

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/validate` | `{ graph: MPCGGraphInput }` | `{ valid, errors, warnings, stats }` |

Uses `@mpcg/core` `validate()` function. Returns the `ValidationResult` directly.

### Graph Operations

| Method | Path | Request/Params | Response |
|--------|------|----------------|----------|
| POST | `/api/graph/load` | `{ graph: MPCGGraphInput }` | `{ id, stats }` — validates, creates MPCGGraph, stores in memory Map keyed by `graph.id` |
| GET | `/api/graph/:id/stats` | — | Node/edge counts, type distributions (via `graph.stats()`) |
| GET | `/api/graph/:id/contradictions` | — | All contradiction pairs (via `graph.contradictions()`) |
| GET | `/api/graph/:id/beliefs/:agentId` | — | Beliefs held by agent (via `graph.beliefsOf(agentId)`) |
| GET | `/api/graph/:id/provenance/:nodeId` | — | Sources, evidence, assertors (via `graph.provenance(nodeId)`) |
| GET | `/api/graph/:id/causal-chain/:nodeId` | — | Causal chain from node (via `graph.causalChain(nodeId)`) |
| GET | `/api/graph/:id/visible?classification=<level>` | — | Nodes visible at clearance level (via `graph.visibleAt(classification)`) |

**Graph loading behavior:**
- Validate the graph input first using `validate()`
- If invalid, return 400 with validation errors
- If valid, create `new MPCGGraph(data)` and store in Map
- If a graph with the same ID already exists, overwrite it
- Return the graph ID and stats

### Formal Constraints

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/constraints/domain-range` | Domain/range rules for all edge types |
| GET | `/api/constraints/algebra` | Transitivity, symmetry, inverse pairs |

These rules must be extracted from the `@mpcg/core` validate.js source code and served as static JSON data. The core package performs domain/range checking internally but does not expose the rules as a standalone API.

**Domain/range rules to extract:**
- Agent-requiring edge types (decides, intends, believes, knows, assumes, doubts, feels, commands, operational_control, tactical_control) — source must be Agent subtype
- Place-requiring edges (located_at) — target must be Place subtype
- Measurement-requiring edges (measures) — source must be Measurement/Metric/Rating/Threshold subtype

**Algebraic properties to extract:**
- Causal edge types (causes, enables, transforms, disrupts, amplifies, cascades_to, overwhelms) — used by causalChain traversal
- Symmetric edges (if any)
- Inverse pairs (if any)
- Transitive edges (if any)

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MPCG_PROJECT_DIR` | `../../` | Path to MPCG project root (for reading scenarios/) |
| `PORT` | `3001` | Server listen port |

---

## CORS

Enable CORS for `localhost:5173` (Vite dev server default).

---

## Error Responses

All error responses must use RFC 7807 Problem Details format:

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Graph with ID 'abc' not found"
}
```

Standard HTTP status codes:
- `400` — Invalid input (validation fails, malformed JSON)
- `404` — Resource not found (graph, scenario, node)
- `500` — Internal server error

---

## Dependencies on @mpcg/core

The API uses these exports from `@mpcg/core`:

| Export | Usage |
|--------|-------|
| `validate(graph, options?)` | POST /api/validate, POST /api/graph/load |
| `MPCGGraph` class | All /api/graph/:id/* endpoints |
| `schema` | GET /api/schema |
| `taxonomy` | GET /api/taxonomy, /api/types/*, /api/types/search |
| `nodeTypes` | GET /api/types/nodes |
| `edgeTypes` | GET /api/types/edges |

---

## Technical Context

From codebase research:
- **Module system:** ESM (`"type": "module"`) — must match @mpcg/core
- **Package manager:** pnpm with workspace protocol (`"@mpcg/core": "workspace:*"`)
- **Testing:** Node's built-in `node:test` + `node:assert/strict` + `supertest`
- **Node version:** 20+ required
- **Graph performance:** All MPCGGraph lookups are O(1) via internal indices; traversals are BFS

---

## Success Criteria

1. `npm start` launches the API on localhost:3001
2. `GET /api/taxonomy` returns the full type hierarchy
3. `GET /api/types/search?q=belief` returns matching node and edge types with descriptions
4. `POST /api/validate` with a valid graph returns `{ valid: true }`
5. `POST /api/validate` with an invalid graph returns errors in the response
6. `POST /api/graph/load` stores a graph and returns `{ id, stats }`
7. Graph query endpoints (`contradictions`, `beliefs`, `provenance`, `causal-chain`, `visible`) return correct results against loaded graphs
8. `GET /api/scenarios/:id` returns a constructed MPCG graph from scenario data
9. `GET /api/constraints/domain-range` returns extracted domain/range rules
10. All error responses use RFC 7807 format
11. All tests pass using `node --test`
