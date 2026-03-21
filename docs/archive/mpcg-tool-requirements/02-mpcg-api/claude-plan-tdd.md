# TDD Plan: MPCG REST API Server

Testing framework: Node's built-in `node:test` + `node:assert/strict` + `supertest`
Test runner: `node --test tests/*.test.js`
Pattern: Import `createApp()` → pass to `supertest` → assert responses

---

## 3. Package Configuration

# Test: pnpm workspace resolves @mpcg/api as a workspace package
# Test: @mpcg/core is importable from @mpcg/api context
# Test: package.json has correct "type": "module" and scripts

---

## 4. App Factory & Middleware

# Test: createApp() returns an Express app instance
# Test: createApp({ graphStore }) injects custom Map
# Test: CORS allows requests from http://localhost:5173
# Test: CORS rejects requests from other origins
# Test: express.json() parses valid JSON bodies
# Test: oversized payloads (>5mb) are rejected with 400
# Test: unknown routes return 404 with RFC 7807 format

---

## 5. Error Handling

# Test: ApiError with status 400 returns RFC 7807 with status 400
# Test: ApiError with status 404 returns RFC 7807 with status 404
# Test: unhandled errors return 500 with generic message (no stack trace)
# Test: malformed JSON body returns 400 (SyntaxError handling)
# Test: error responses have Content-Type: application/problem+json
# Test: 500 error detail does not contain file paths or stack traces (V-222610)

---

## 6. Taxonomy & Schema Routes

# Test: GET /api/taxonomy returns 200 with nodeTypes and edgeTypes keys
# Test: GET /api/taxonomy response matches @mpcg/core taxonomy export
# Test: GET /api/schema returns 200 with valid JSON Schema
# Test: GET /api/types/nodes returns flat array of { name, description } objects
# Test: GET /api/types/nodes includes known types (e.g., "Person", "Organization")
# Test: GET /api/types/edges returns flat array of { name, description } objects
# Test: GET /api/types/edges includes known types (e.g., "believes", "causes")
# Test: GET /api/types/search?q=belief returns matching node and edge types
# Test: GET /api/types/search?q=belief matches on description text, not just name
# Test: GET /api/types/search is case-insensitive
# Test: GET /api/types/search without q parameter returns 400
# Test: GET /api/types/search?q= (empty) returns 400

---

## 7. Scenario Routes

# Test: GET /api/scenarios returns array with id, group, subgroup fields
# Test: GET /api/scenarios returns entityCount and relationshipCount per scenario
# Test: GET /api/scenarios/groups returns group/subgroup hierarchy
# Test: GET /api/scenarios/groups is registered before /:id (no route conflict)
# Test: GET /api/scenarios/:id with valid ID returns scenario data
# Test: GET /api/scenarios/:id includes constructed MPCG graph
# Test: constructed graph has nodes with UUIDs as IDs
# Test: constructed graph has edges referencing valid node IDs
# Test: constructed graph passes validate()
# Test: GET /api/scenarios/:id with unknown ID returns 404
# Test: scenario with duplicate labels uses first-match for edge resolution

---

## 8. Validation Route

# Test: POST /api/validate with valid graph returns { valid: true }
# Test: POST /api/validate with invalid graph returns { valid: false, errors: [...] }
# Test: POST /api/validate with missing graph property returns 400
# Test: POST /api/validate with null graph returns 400
# Test: POST /api/validate with malformed JSON returns 400
# Test: POST /api/validate response includes stats object
# Test: POST /api/validate does not store the graph (GET /api/graph/:id returns 404)

---

## 9. Graph Routes

# Test: POST /api/graph/load with valid graph returns { id, stats }
# Test: POST /api/graph/load stores graph retrievable via GET /api/graph/:id/stats
# Test: POST /api/graph/load with invalid graph returns 400 with validation errors
# Test: POST /api/graph/load with missing graph property returns 400
# Test: POST /api/graph/load with same ID overwrites previous graph
# Test: DELETE /api/graph/:id removes graph from store (204)
# Test: DELETE /api/graph/:id with unknown ID returns 404
# Test: GET /api/graph/:id/stats returns node/edge counts
# Test: GET /api/graph/:id/stats with unknown ID returns 404
# Test: GET /api/graph/:id/contradictions returns contradiction pairs
# Test: GET /api/graph/:id/beliefs/:agentId returns belief targets
# Test: GET /api/graph/:id/provenance/:nodeId returns sources/evidence/assertors
# Test: GET /api/graph/:id/provenance/:nodeId has no undefined entries in arrays
# Test: GET /api/graph/:id/causal-chain/:nodeId returns chain entries
# Test: GET /api/graph/:id/causal-chain/:nodeId?maxDepth=2 respects depth limit
# Test: GET /api/graph/:id/visible?classification=UGRADERT returns filtered graph
# Test: GET /api/graph/:id/visible without classification returns 400
# Test: GET /api/graph/:id/visible?classification=INVALID returns 400
# Test: GET /api/graph/:id/visible?releasableTo=X passes parameter through

---

## 10. Constraint Routes

# Test: GET /api/constraints/domain-range returns rules array
# Test: domain-range rules include agent-requiring edge types (believes, knows, etc.)
# Test: domain-range rules include place-requiring edge type (located_at)
# Test: domain-range rules include measurement-requiring edge type (measures)
# Test: all edge types in rules are valid per @mpcg/core edgeTypes
# Test: GET /api/constraints/algebra returns causalEdges array
# Test: causalEdges includes known causal types (causes, enables, transforms)
# Test: algebra response includes symmetricEdges, inversePairs, transitiveEdges keys
