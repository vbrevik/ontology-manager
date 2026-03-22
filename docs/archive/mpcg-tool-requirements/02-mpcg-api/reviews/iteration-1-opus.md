# Opus Review

**Model:** claude-opus-4
**Generated:** 2026-03-21T11:15:00Z

---

## Plan Review: MPCG REST API Server

### 1. Double Validation in POST /api/graph/load (Section 9)

The plan says to call `validate(graph)` first, then `new MPCGGraph(graph)`. But the `MPCGGraph` constructor already calls `validate(data)` internally and throws on invalid input. This means every successful load validates the graph twice. The plan should either:
- Acknowledge this is intentional (clarity over performance) and document it, or
- Pass the graph data to `MPCGGraph` directly and catch the thrown error, converting it to a 400 response.

### 2. Scenario ID Collision Risk (Section 7)

Scenarios are loaded from disk and identified by their `id` field. The plan says nothing about what happens if two scenario files in different subdirectories have the same `id` value. Since they are keyed by `id` in a flat cache, the second one would silently overwrite the first. The plan should specify that scenario loading validates ID uniqueness or uses the file path as the key.

### 3. Scenario Route Ambiguity: /api/scenarios/groups vs /api/scenarios/:id (Section 7)

Express matches routes in order. `GET /api/scenarios/groups` and `GET /api/scenarios/:id` conflict -- a request to `/api/scenarios/groups` will match `:id` with value `"groups"` if the `:id` route is registered first. The plan should explicitly state that the `/groups` route must be registered before the `/:id` route, or this will be a bug.

### 4. Missing maxDepth Parameter for Causal Chain (Section 9)

The `causalChain(startId, maxDepth)` method accepts a `maxDepth` parameter (default 10). The plan's endpoint does not expose this. Consider adding `?maxDepth=N` as an optional query parameter.

### 5. visibleAt Has a Second Parameter Not Exposed (Section 9)

The `visibleAt(classification, releasableTo)` method accepts a second `releasableTo` parameter. The plan only exposes `?classification=<level>`. Should note this omission explicitly.

### 6. Invalid Classification Level Handling (Section 9)

`GET /api/graph/:id/visible?classification=<level>` validates presence but not value. Unknown levels produce silently misleading results. The plan should specify validation against allowed classification levels.

### 7. UUID Dependency is Unnecessary (Section 3)

The plan lists `uuid` as a dependency. Node 20+ has `crypto.randomUUID()` built in. The `uuid` package is unnecessary.

### 8. CORS Origin is Too Narrow (Section 4)

CORS is locked to `http://localhost:5173`. Consider making the origin configurable via environment variable (e.g., `CORS_ORIGIN`).

### 9. No Memory Bounds on Graph Store (Section 9)

A client can POST hundreds of large graphs and exhaust server memory. The plan should note the risk.

### 10. Missing Content-Type Header on Error Responses

RFC 7807 specifies `Content-Type: application/problem+json`. Express defaults to `application/json`. This matters if clients distinguish between the two.

### 11. Scenario Graph Construction Assumes Unique Labels (Section 7)

If two entities have the same label, edge resolution becomes ambiguous. Specify what happens (error? first-match? skip?).

### 12. No DELETE Endpoint for Graphs (Section 9)

No way to remove a loaded graph from the store. Adding `DELETE /api/graph/:id` is trivial and useful.

### 13. Hardcoded Domain/Range Rules Drift Risk (Section 10)

Static data in `lib/constraints.js` duplicates logic from `@mpcg/core`'s `validate.js`. If core is updated, the API copy silently goes stale. Consider exporting rules from core, or at minimum adding a cross-reference test.

### 14. Scenario Caching Timing (Section 7)

Ambiguous whether scenarios are loaded at startup or lazily on first request. Should be explicit.

### 15. Missing Test for Graph Overwrite Behavior (Section 11)

Section 9 specifies overwrite on same ID but no test covers this.

### 16. provenance() Returns Potentially Undefined Nodes

Core's `provenance()` doesn't filter out undefined results from `getNode()`. API should be aware it may need to filter.

### 17. Section Mapping for Implementation

Current plan is a single monolithic document. If this drives `/deep-implement`, it needs clear section boundaries for the implementation tooling.

---

### Summary

Most actionable issues:
1. **Route ordering ambiguity** (item 3) -- will be an actual bug
2. **Drop `uuid` dependency** (item 7) -- `crypto.randomUUID()` is already used
3. **Double validation** (item 1) -- clarify design intent
4. **Static constraint drift** (item 13) -- architectural weakness
5. **Missing overwrite test** (item 15) -- gap in test plan
