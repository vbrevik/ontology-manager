# Implementation Plan: MPCG REST API Server

## 1. What We're Building

A lightweight Node.js REST API server (`packages/api/`) that wraps the `@mpcg/core` library and serves MPCG (Multi-Perspective Context Graph) data to a web frontend. The API is a thin data-serving layer — all graph validation, querying, and type operations delegate to the core library.

### Background

The MPCG project models multi-perspective knowledge graphs using an ontology of 127 node types and 98 edge types. The `@mpcg/core` package (already implemented) provides:

- **`validate(graph, options?)`** — validates graph input against JSON Schema and semantic rules, returning `{ valid, errors, warnings, stats }`
- **`MPCGGraph` class** — creates indexed, queryable graph instances with methods for traversal, contradiction detection, belief queries, provenance tracking, causal chain analysis, and security-based filtering
- **`schema`** and **`taxonomy`** constants — the full JSON Schema and hierarchical type taxonomy
- **`nodeTypes`** and **`edgeTypes`** arrays — flat lists of valid type names

The API exposes these capabilities over HTTP so the web frontend (a separate Vite/React app at `localhost:5173`) can access them.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Express.js | Mature ecosystem, supertest integration, team familiarity |
| Data source | `@mpcg/core` exports | Guaranteed consistency; only scenarios read from disk |
| Graph storage | In-memory `Map` | No persistence needed; simple, sufficient for dev/demo |
| Graph IDs | Use `graph.id` from input | Clients control identity; no server-generated UUIDs |
| Authentication | None | Local development tool only |
| Error format | RFC 7807 Problem Details | Standard format: `{ type, title, status, detail }` |
| Test framework | Node's built-in `node:test` | Matches @mpcg/core convention |
| CORS | `localhost:5173` only | Vite dev server default |

---

## 2. Project Structure

```
packages/api/
├── package.json
├── app.js               ← Express app factory (createApp)
├── server.js            ← Entry point: imports app, calls listen()
├── routes/
│   ├── taxonomy.js      ← /api/taxonomy, /api/schema, /api/types/*
│   ├── scenarios.js     ← /api/scenarios/*
│   ├── validate.js      ← /api/validate
│   ├── graph.js         ← /api/graph/*
│   └── constraints.js   ← /api/constraints/*
├── lib/
│   ├── errors.js        ← RFC 7807 error factory + Express error handler
│   ├── scenarios.js     ← Scenario loading + graph construction
│   └── constraints.js   ← Domain/range + algebra rule extraction
└── tests/
    ├── taxonomy.test.js
    ├── scenarios.test.js
    ├── validate.test.js
    ├── graph.test.js
    ├── constraints.test.js
    └── helpers/
        └── fixtures.js  ← Shared test graph factories
```

### Why app.js and server.js are separate

The `createApp()` factory in `app.js` creates and configures the Express app. The `server.js` file imports it and calls `listen()`. This separation lets tests import the app without starting a server — supertest manages its own ephemeral server internally.

---

## 3. Package Configuration

The package lives in the pnpm workspace alongside `@mpcg/core`.

### package.json shape

```json
{
  "name": "@mpcg/api",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests/*.test.js"
  }
}
```

### Dependencies

- **`@mpcg/core`** (`workspace:*`) — core library
- **`express`** — HTTP framework
- **`cors`** — CORS middleware
No `uuid` dependency needed — Node 20+ provides `crypto.randomUUID()` built-in, which is already used throughout `@mpcg/core` tests.

### Dev dependencies

- **`supertest`** — HTTP assertion testing

### Workspace integration

Add `packages/api` to the existing `pnpm-workspace.yaml` (which already has `packages/*` glob, so this should be automatic).

---

## 4. App Factory & Middleware

### createApp(options?)

The app factory accepts optional dependency injection for testing:

```javascript
function createApp(options = {})
```

**Options:**
- `graphStore` — injectable `Map` instance (defaults to `new Map()`)
- `scenarioDir` — path to scenarios directory (defaults to `MPCG_PROJECT_DIR/src/scenarios`)

**Middleware stack (in order):**
1. `cors({ origin: 'http://localhost:5173' })`
2. `express.json({ limit: '5mb' })` — graphs can be moderately large
3. Route mounting (`/api/taxonomy`, `/api/scenarios`, etc.)
4. 404 handler — returns RFC 7807 response
5. Centralized error handler (4-param) — catches all thrown/next(err) errors

### Configuration

Two environment variables:
- `PORT` — defaults to `3001`
- `MPCG_PROJECT_DIR` — defaults to `path.resolve(import.meta.dirname, '../../')` (project root relative to packages/api/)

---

## 5. Error Handling

### RFC 7807 Problem Details

All error responses use this shape:

```typescript
{
  type: string       // "about:blank" for generic errors
  title: string      // HTTP status text (e.g., "Not Found")
  status: number     // HTTP status code
  detail: string     // Human-readable explanation
}
```

### Error factory

A helper function creates Problem Details objects:

```javascript
function createProblem(status, detail)
```

Returns `{ type: "about:blank", title: httpStatusText, status, detail }`. Sets `Content-Type: application/problem+json` per RFC 7807.

### Custom error class

An `ApiError` class extends `Error` with a `status` property. Route handlers throw `ApiError` instances; the centralized error handler catches them and formats the response.

### Centralized error handler

The 4-param Express error handler:
1. If `res.headersSent`, delegates to Express default
2. If error is `ApiError`, sends RFC 7807 with the error's status
3. If error is `SyntaxError` from `express.json()` (malformed JSON), sends 400
4. Otherwise sends 500 with generic message — no stack traces, no internal paths (V-222610)

### STIG compliance notes

- V-222610: Error responses never include stack traces, file paths, or internal details. Generic message for 500s.
- V-222585: On unexpected errors, the handler returns 500 (deny) rather than silently continuing.
- V-222609: Malformed JSON is caught and returned as 400, not a crash.

---

## 6. Taxonomy & Schema Routes

### GET /api/taxonomy

Returns the full taxonomy tree from `@mpcg/core`'s `taxonomy` export. Direct passthrough — no transformation needed.

### GET /api/schema

Returns the full JSON Schema from `@mpcg/core`'s `schema` export. Direct passthrough.

### GET /api/types/nodes

Flattens the taxonomy's `nodeTypes` hierarchy into a flat array of `{ name, description }` objects. Walks the tree recursively, extracting each type's name (the key) and description.

### GET /api/types/edges

Same as nodes but for `edgeTypes`.

### GET /api/types/search?q=<term>

Searches both node and edge types. For each type in the flattened lists, checks if the search term (case-insensitive) appears in either the type name or its description. Returns matching results grouped by category (`nodeTypes`, `edgeTypes`).

**Validation:** If `q` parameter is missing or empty, return 400.

---

## 7. Scenario Routes

### Scenario loading

A `lib/scenarios.js` module handles reading scenario files from disk:
- Reads `MPCG_PROJECT_DIR/src/scenarios/` recursively
- Loads `_groups.json` for group metadata
- Parses each `.json` scenario file
- Caches loaded scenarios (they don't change at runtime)

### Graph construction from scenarios

Each scenario has `expected_entities` and `expected_relationships`. The API constructs valid MPCG graphs:

1. Generate a UUID for the graph
2. For each `expected_entity`: create a node with a generated UUID, the entity's `expected_type` as type, and `label` as label
3. For each `expected_relationship`: find source and target nodes by matching their labels, create an edge with the `expected_type`
4. If a relationship references a label that doesn't match any entity, skip that edge (log warning)
5. The constructed graph should pass `validate()`

### GET /api/scenarios

Returns a list of all scenarios with summary info: `{ id, group, subgroup, entityCount, relationshipCount, description }`. Does not include constructed graphs (too heavy for a list endpoint).

### GET /api/scenarios/groups

Returns the group/subgroup hierarchy from `_groups.json`.

**Route ordering:** This route MUST be registered before `/:id` in the Express router. Otherwise Express will match `"groups"` as an `:id` parameter and the groups endpoint will never be reached.

### GET /api/scenarios/:id

Returns the full scenario data including the constructed MPCG graph. Scenario metadata is loaded at startup (one-time disk read). Graph construction happens lazily on first request for each scenario, then is cached for subsequent requests.

**Label matching:** When resolving edge source/target by label, use first-match if duplicate labels exist (log warning). Scenarios are expected to have unique labels per file.

**Error:** 404 if scenario ID doesn't match any loaded scenario.

---

## 8. Validation Route

### POST /api/validate

Accepts `{ graph: MPCGGraphInput }` in the request body.

1. Validate that request body has a `graph` property (400 if missing)
2. Call `validate(graph)` from `@mpcg/core`
3. Return the `ValidationResult` directly: `{ valid, errors, warnings, stats }`

This endpoint does NOT store the graph — it only validates. Use `/api/graph/load` to store.

**Input validation (V-222606):** Check that `graph` is a non-null object before passing to `validate()`.

---

## 9. Graph Routes

### In-memory graph store

A `Map<string, MPCGGraph>` stores loaded graph instances. The map is passed via dependency injection from `createApp()`.

### POST /api/graph/load

1. Validate request body has `graph` property (400 if missing)
2. Try `new MPCGGraph(graph)` — the constructor internally calls `validate()` and throws if invalid
3. Catch constructor errors and return 400 with validation details (avoids double-validation)
4. Store in Map keyed by `graph.id`. If a graph with the same ID already exists, overwrite it silently
5. Return `{ id: graph.id, stats: graphInstance.stats() }`

### DELETE /api/graph/:id

Remove a loaded graph from the store. Returns 204 on success, 404 if not found.

### GET /api/graph/:id/stats

Look up graph by ID in store. Return `graph.stats()`. 404 if not found.

### GET /api/graph/:id/contradictions

Look up graph. Return `graph.contradictions()`. The result is an array of `{ a, b, edge }` objects where `a` and `b` are the contradicting nodes.

### GET /api/graph/:id/beliefs/:agentId

Look up graph. Return `graph.beliefsOf(agentId)`. The result is an array of nodes that the specified agent believes in.

### GET /api/graph/:id/provenance/:nodeId

Look up graph. Return `graph.provenance(nodeId)`. The result has `sources`, `evidence`, and `assertors` arrays.

### GET /api/graph/:id/provenance/:nodeId (defensive filtering)

Look up graph. Return `graph.provenance(nodeId)`. The result has `sources`, `evidence`, and `assertors` arrays. Apply `.filter(Boolean)` to each array before returning — the core `provenance()` method may include `undefined` entries if edges reference non-existent nodes.

### GET /api/graph/:id/causal-chain/:nodeId

Look up graph. Return `graph.causalChain(nodeId, maxDepth)`. The result is an array of `{ node, depth }` entries.

**Optional query param:** `?maxDepth=N` (integer, defaults to 10). Allows clients to control traversal depth.

### GET /api/graph/:id/visible?classification=<level>

Look up graph. Call `graph.visibleAt(classification, releasableTo)`. Return the filtered `{ nodes, edges }`.

**Required query param:** `classification` — must be one of the valid STANAG 4774 levels: `UGRADERT`, `BEGRENSET`, `KONFIDENSIELT`, `HEMMELIG`, `STRENGT HEMMELIG`. Return 400 if missing or invalid.

**Optional query param:** `releasableTo` — passed through to `visibleAt()` for future use.

### Common pattern: graph lookup middleware

All `/api/graph/:id/*` routes need to look up the graph from the store and return 404 if not found. A shared middleware or helper function avoids repetition.

---

## 10. Constraint Routes

### Extracting domain/range rules

The `@mpcg/core` validate.js performs domain/range checks internally but doesn't export the rules as data. The API must define these rules as static data in `lib/constraints.js`:

**Agent-requiring edges** (source must be Agent subtype):
`decides`, `intends`, `believes`, `knows`, `assumes`, `doubts`, `feels`, `commands`, `operational_control`, `tactical_control`

**Place-requiring edges** (target must be Place subtype):
`located_at`

**Measurement-requiring edges** (source must be Measurement/Metric/Rating/Threshold subtype):
`measures`

### GET /api/constraints/domain-range

Returns the domain/range rules as a JSON object:

```typescript
{
  rules: Array<{
    edgeTypes: string[],
    constraint: "source" | "target",
    requiredSupertype: string,
    description: string
  }>
}
```

### Extracting algebraic properties

**Causal edges** (followed by `causalChain`):
`causes`, `enables`, `transforms`, `disrupts`, `amplifies`, `cascades_to`, `overwhelms`

**Symmetric edges, inverse pairs, transitive edges:** These need to be identified from the taxonomy and schema. If none are formally defined, return empty arrays with a note that algebraic properties are not yet formally specified in the ontology.

### GET /api/constraints/algebra

Returns algebraic properties:

```typescript
{
  causalEdges: string[],
  symmetricEdges: string[],
  inversePairs: Array<[string, string]>,
  transitiveEdges: string[]
}
```

---

## 11. Testing Strategy

### Framework

All tests use Node's built-in `node:test` module with `node:assert/strict`, matching the existing `@mpcg/core` convention. HTTP assertions use `supertest`.

### Test structure

Each route file has a corresponding test file. Tests import `createApp()` and pass it to `supertest` — no running server needed.

### Shared fixtures

A `tests/helpers/fixtures.js` module provides:

```javascript
function makeValidGraph(overrides = {})
function makeInvalidGraph()
function makeGraphWithContradictions()
function makeGraphWithBeliefs()
```

These create minimal but valid MPCG graph inputs using `crypto.randomUUID()` for IDs.

### Test categories per route

**taxonomy.test.js:**
- GET /api/taxonomy returns full taxonomy with correct structure
- GET /api/schema returns valid JSON Schema
- GET /api/types/nodes returns flat list with descriptions
- GET /api/types/edges returns flat list with descriptions
- GET /api/types/search returns matching results for known terms
- GET /api/types/search with empty q returns 400

**scenarios.test.js:**
- GET /api/scenarios returns list with expected fields
- GET /api/scenarios/:id returns scenario with constructed graph
- GET /api/scenarios/:id with unknown ID returns 404
- GET /api/scenarios/groups returns group hierarchy
- Constructed graphs pass validation

**validate.test.js:**
- POST /api/validate with valid graph returns `{ valid: true }`
- POST /api/validate with invalid graph returns errors
- POST /api/validate with missing graph property returns 400
- POST /api/validate with malformed JSON returns 400
- Error response uses RFC 7807 format

**graph.test.js:**
- POST /api/graph/load stores graph and returns stats
- POST /api/graph/load with invalid graph returns 400
- POST /api/graph/load with same ID overwrites previous graph
- DELETE /api/graph/:id removes loaded graph (204)
- DELETE /api/graph/:id with unknown ID returns 404
- GET /api/graph/:id/stats returns stats for loaded graph
- GET /api/graph/:id/stats with unknown ID returns 404
- GET /api/graph/:id/contradictions returns contradiction pairs
- GET /api/graph/:id/beliefs/:agentId returns beliefs
- GET /api/graph/:id/provenance/:nodeId returns provenance data
- GET /api/graph/:id/causal-chain/:nodeId returns chain
- GET /api/graph/:id/causal-chain/:nodeId?maxDepth=N respects depth limit
- GET /api/graph/:id/visible?classification=X returns filtered graph
- GET /api/graph/:id/visible with invalid classification returns 400

**constraints.test.js:**
- GET /api/constraints/domain-range returns rules array
- GET /api/constraints/algebra returns algebraic properties
- Domain/range rules reference valid edge types

### Test execution

```bash
pnpm --filter @mpcg/api test
# → node --test tests/*.test.js
```

### STIG compliance in tests

- Test that 500 errors return generic messages, not stack traces (V-222610)
- Test that malformed JSON returns 400, not crash (V-222609)
- Test that missing required fields return 400 with clear detail (V-222606)

---

## 12. Build & Run

### No build step

The API is plain JavaScript (ESM) — no compilation, no bundling. Just `node server.js`.

### Development workflow

```bash
# From project root:
pnpm install                        # Install all workspace dependencies
pnpm --filter @mpcg/core build      # Build core package first (generates schema.json, taxonomy.json)
pnpm --filter @mpcg/api start       # Start the API server

# Or for development with auto-restart:
# (optional — add nodemon as dev dependency)
```

### Startup sequence

1. `server.js` imports `createApp` from `app.js`
2. `createApp()` loads scenario metadata from disk (one-time, reads JSON files)
3. Express app is configured with middleware and routes
4. Server listens on `PORT` (default 3001)
5. Startup message confirms: `MPCG API listening on http://localhost:3001`
6. Graph construction from scenarios happens lazily on first request per scenario

---

## 13. Security & Compliance Notes

This is a local development tool with no authentication, no persistence, and no public exposure. The security posture is minimal but follows baseline STIG controls for input validation and error handling.

| Control | Implementation |
|---------|---------------|
| V-222606 (Input validation) | All POST body inputs validated before processing; missing/malformed fields return 400 |
| V-222609 (Input handling) | `express.json({ limit: '5mb' })` prevents oversized payloads; malformed JSON caught gracefully |
| V-222585 (Fail secure) | Unhandled errors return 500 (deny), never silently succeed |
| V-222610 (Error messages) | 500 responses use generic message; detailed errors logged server-side only |
| V-222611 (Error visibility) | Stack traces and internal paths never included in HTTP responses |

### Not applicable (local dev context)

- Authentication/authorization controls — no auth by design
- Session management — stateless API
- TLS/encryption — localhost only
- Audit logging — not required for dev tooling
- Password policies — no user accounts
