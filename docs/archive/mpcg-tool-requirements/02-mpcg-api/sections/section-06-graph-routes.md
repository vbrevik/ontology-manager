The dependency sections don't exist yet. I have enough context to generate the section content now.

# Section 06: Graph Routes

## Overview

This section implements the graph management routes for the MPCG API. These routes allow clients to load MPCG graphs into an in-memory store, query them using the `MPCGGraph` engine from `@mpcg/core`, and delete them when no longer needed. The graph store is a `Map<string, MPCGGraph>` injected via `createApp()`.

**Depends on:** section-01-package-setup (Express app factory, test infrastructure), section-02-error-handling (ApiError class, RFC 7807 error handler)

**Files to create:**
- `packages/api/routes/graph.js` -- Express router for all `/api/graph/*` endpoints
- `packages/api/tests/graph.test.js` -- Tests for graph routes

**Files to modify:**
- `packages/api/app.js` -- Mount the graph router at `/api/graph`

---

## Tests First

Create `packages/api/tests/graph.test.js` using `node:test` and `supertest`. The tests import `createApp()` and use shared fixtures from `tests/helpers/fixtures.js` (created in section-01).

### Test stubs

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeValidGraph, makeGraphWithContradictions, makeGraphWithBeliefs } from './helpers/fixtures.js';

describe('POST /api/graph/load', () => {
  /** Test: valid graph returns { id, stats } with 200 */

  /** Test: stores graph retrievable via GET /api/graph/:id/stats */

  /** Test: invalid graph returns 400 with validation errors */

  /** Test: missing graph property returns 400 */

  /** Test: same ID overwrites previous graph */
});

describe('DELETE /api/graph/:id', () => {
  /** Test: removes graph from store (204) */

  /** Test: unknown ID returns 404 */
});

describe('GET /api/graph/:id/stats', () => {
  /** Test: returns node/edge counts for loaded graph */

  /** Test: unknown ID returns 404 */
});

describe('GET /api/graph/:id/contradictions', () => {
  /** Test: returns contradiction pairs */
});

describe('GET /api/graph/:id/beliefs/:agentId', () => {
  /** Test: returns belief targets for given agent */
});

describe('GET /api/graph/:id/provenance/:nodeId', () => {
  /** Test: returns sources/evidence/assertors */

  /** Test: has no undefined entries in arrays */
});

describe('GET /api/graph/:id/causal-chain/:nodeId', () => {
  /** Test: returns chain entries */

  /** Test: maxDepth=2 respects depth limit */
});

describe('GET /api/graph/:id/visible', () => {
  /** Test: classification=UGRADERT returns filtered graph */

  /** Test: missing classification returns 400 */

  /** Test: invalid classification value returns 400 */

  /** Test: releasableTo parameter passes through */
});
```

### Test patterns

Each test that queries a loaded graph follows this pattern:

1. Create a fresh app with `createApp()`
2. POST a valid graph to `/api/graph/load`
3. Make the query request against the loaded graph's ID
4. Assert the response status and body shape

For the "unknown ID returns 404" tests, simply make a GET request with a random UUID without loading anything first.

For the overwrite test, POST two different graphs with the same `graph.id` and verify the stats reflect the second graph.

### Fixture requirements

The shared fixtures module (`tests/helpers/fixtures.js`, created in section-01) must provide:

- **`makeValidGraph(overrides?)`** -- Minimal valid graph with a few nodes and edges, using `crypto.randomUUID()` for IDs. Must pass `@mpcg/core` `validate()`.
- **`makeGraphWithContradictions()`** -- Graph containing at least two nodes connected by a `contradicts` edge.
- **`makeGraphWithBeliefs()`** -- Graph containing an Agent-type node connected to other nodes via `believes` edges.

For provenance tests, the test itself can construct a graph with `sourced_from`, `evidenced_by`, or `asserted_by` edges inline, or a `makeGraphWithProvenance()` helper can be added.

For causal chain tests, construct a graph with a chain of nodes connected by `causes` edges (e.g., A --causes--> B --causes--> C --causes--> D) to verify depth traversal and maxDepth limiting.

For visibility tests, construct a graph where some nodes have `security.classification` set to different levels (e.g., `UGRADERT`, `HEMMELIG`) and verify that filtering at `UGRADERT` excludes the `HEMMELIG` nodes.

---

## Implementation Details

### Route file: `packages/api/routes/graph.js`

This file exports a function that accepts the `graphStore` (a `Map`) and returns an Express `Router`.

```javascript
import { Router } from 'express';
import { MPCGGraph } from '@mpcg/core';
import { ApiError } from '../lib/errors.js';

export default function graphRoutes(graphStore) {
  const router = Router();
  // ... route definitions
  return router;
}
```

### Graph lookup middleware

All `/api/graph/:id/*` routes need to look up the graph from the store and 404 if not found. Define a param middleware or a shared helper:

```javascript
function lookupGraph(req, res, next) {
  const graph = graphStore.get(req.params.id);
  if (!graph) throw new ApiError(404, `Graph not found: ${req.params.id}`);
  req.graph = graph;
  next();
}
```

Attach this with `router.param('id', lookupGraph)` or use it as middleware on individual routes. Note: the `POST /api/graph/load` and `DELETE /api/graph/:id` routes have different lookup semantics (load doesn't require existing, delete does), so apply the middleware selectively to the GET query routes.

### POST /api/graph/load

1. Validate that `req.body.graph` exists and is a non-null object. If not, throw `ApiError(400, 'Request body must include a graph object')`.
2. Try `new MPCGGraph(req.body.graph)`. The constructor calls `validate()` internally and throws an `Error` with message `"Invalid graph: ..."` if validation fails.
3. Catch constructor errors: return 400 with the error message as the RFC 7807 detail.
4. Store the instance in `graphStore.set(graphInstance.id, graphInstance)`. This naturally handles overwrites -- setting the same key replaces the previous value.
5. Respond 200 with `{ id: graphInstance.id, stats: graphInstance.stats() }`.

### DELETE /api/graph/:id

1. Check if `graphStore.has(req.params.id)`. If not, throw `ApiError(404, ...)`.
2. Call `graphStore.delete(req.params.id)`.
3. Respond with 204 (no content).

### GET /api/graph/:id/stats

Return `req.graph.stats()`. The `stats()` method returns `{ nodes, edges, nodeTypes, edgeTypes, perspective, security }`.

### GET /api/graph/:id/contradictions

Return `req.graph.contradictions()`. Returns an array of `{ a, b, edge }` where `a` and `b` are the contradicting nodes and `edge` is the connecting `contradicts` edge.

### GET /api/graph/:id/beliefs/:agentId

Return `req.graph.beliefsOf(req.params.agentId)`. Returns an array of nodes that the agent believes in. Note this route has a nested param `:agentId` in addition to `:id`.

### GET /api/graph/:id/provenance/:nodeId

Call `req.graph.provenance(req.params.nodeId)`. The core `provenance()` method may include `undefined` entries in the `sources`, `evidence`, and `assertors` arrays if edges reference non-existent nodes. Apply `.filter(Boolean)` to each array before sending the response:

```javascript
const result = req.graph.provenance(req.params.nodeId);
res.json({
  sources: result.sources.filter(Boolean),
  evidence: result.evidence.filter(Boolean),
  assertors: result.assertors.filter(Boolean)
});
```

### GET /api/graph/:id/causal-chain/:nodeId

Read `maxDepth` from query parameter, parse as integer, default to 10. Call `req.graph.causalChain(req.params.nodeId, maxDepth)`. Returns an array of `{ node, depth }` entries.

```javascript
const maxDepth = parseInt(req.query.maxDepth, 10) || 10;
```

### GET /api/graph/:id/visible

**Required query parameter:** `classification`. Must be one of the valid STANAG 4774 levels:
- `UGRADERT`
- `BEGRENSET`
- `KONFIDENSIELT`
- `HEMMELIG`
- `STRENGT HEMMELIG`

If `classification` is missing or not in the valid set, throw `ApiError(400, ...)`.

**Optional query parameter:** `releasableTo`. Passed through to `graph.visibleAt()`.

```javascript
const VALID_CLASSIFICATIONS = ['UGRADERT', 'BEGRENSET', 'KONFIDENSIELT', 'HEMMELIG', 'STRENGT HEMMELIG'];

// In the route handler:
const { classification, releasableTo } = req.query;
if (!classification || !VALID_CLASSIFICATIONS.includes(classification)) {
  throw new ApiError(400, `classification is required and must be one of: ${VALID_CLASSIFICATIONS.join(', ')}`);
}
res.json(req.graph.visibleAt(classification, releasableTo));
```

The `visibleAt()` method returns `{ nodes, edges }` where each array contains only items whose `security.classification` level is at or below the requested level. Nodes and edges without a `security.classification` property are treated as visible (unclassified).

### Route registration in app.js

In `createApp()`, mount the graph router:

```javascript
import graphRoutes from './routes/graph.js';

// Inside createApp():
app.use('/api/graph', graphRoutes(graphStore));
```

The `graphStore` is the `Map` instance either injected via options or created as `new Map()` by default.

---

## Key API Contracts

### MPCGGraph constructor

The `MPCGGraph` constructor from `@mpcg/core` accepts graph input data and:
- Calls `validate(data)` internally
- Throws `Error` with message `"Invalid graph: <errors joined by '; '>"` if validation fails
- On success, builds internal indices (adjacency maps, type indices)

The constructor does NOT return a validation result -- it either succeeds or throws. This means the `/api/graph/load` route wraps the constructor in try/catch rather than calling `validate()` separately.

### Graph input shape

A valid graph input requires at minimum:
- `id` (string, UUID format)
- `nodes` (array of `{ id, type, label }` objects where type is a valid node type)
- `edges` (array of `{ id, type, source, target }` objects where type is a valid edge type, source/target reference node IDs)

### Classification levels

The STANAG 4774 classification levels used by `visibleAt()`, ordered from least to most restrictive:

1. `UGRADERT` (Unclassified)
2. `BEGRENSET` (Restricted)
3. `KONFIDENSIELT` (Confidential)
4. `HEMMELIG` (Secret)
5. `STRENGT HEMMELIG` (Top Secret)