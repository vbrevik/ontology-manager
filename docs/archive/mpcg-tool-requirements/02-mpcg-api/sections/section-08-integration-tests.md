Now I have all the context I need. Here is the section content.

# Section 08: Integration Tests

## Overview

This section adds end-to-end integration tests that verify the full request lifecycle across multiple routes. Unlike the per-route unit tests created in sections 03-07, these tests exercise cross-route workflows: loading a graph via one endpoint, querying it via another, validating results, and confirming error response consistency across the entire API surface.

**Plan sections covered:** 11 (Testing Strategy) -- integration test subset

**Dependencies:** section-01 (package setup, app factory, fixtures), section-02 (error handling), section-03 (taxonomy routes), section-04 (scenario loader), section-05 (validation route), section-06 (graph routes), section-07 (constraint routes). All route implementations must be complete before these tests can pass.

**Blocks:** Nothing -- this is the final section.

---

## File Structure

After completing this section, the following file will be created:

```
packages/api/
└── tests/
    └── integration.test.js   # End-to-end cross-route tests
```

No existing files are modified. The test file uses the same infrastructure established in section-01: `node:test`, `node:assert/strict`, `supertest`, and the shared fixtures from `tests/helpers/fixtures.js`.

---

## Tests First

Create `packages/api/tests/integration.test.js`. This file contains all integration tests. It imports `createApp()` and passes it to `supertest` for each test. The shared fixture helpers (`makeValidGraph`, `makeGraphWithContradictions`, `makeGraphWithBeliefs`) from `tests/helpers/fixtures.js` are used to construct test data.

### Test stubs

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { makeValidGraph, makeGraphWithContradictions, makeGraphWithBeliefs } from './helpers/fixtures.js';
```

#### Full lifecycle: load, query, delete

```javascript
describe('Integration: full graph lifecycle', () => {
  // Test: POST /api/graph/load then GET /api/graph/:id/stats returns consistent data
  it('load graph then query stats returns consistent counts', async () => {
    /** Load a valid graph via POST /api/graph/load, then retrieve stats via
     *  GET /api/graph/:id/stats. Assert the stats match the input graph's
     *  node and edge counts. */
  });

  // Test: POST /api/graph/load then DELETE /api/graph/:id then GET returns 404
  it('delete removes graph so subsequent GET returns 404', async () => {
    /** Load a graph, confirm stats are accessible, delete it, then confirm
     *  GET /api/graph/:id/stats returns 404. */
  });

  // Test: POST /api/graph/load then GET /api/graph/:id/contradictions returns expected pairs
  it('loaded graph with contradictions returns contradiction data', async () => {
    /** Load a graph built with makeGraphWithContradictions(), then query
     *  the contradictions endpoint and assert the result is a non-empty array. */
  });

  // Test: POST /api/graph/load then GET /api/graph/:id/beliefs/:agentId returns beliefs
  it('loaded graph with beliefs returns belief targets for agent', async () => {
    /** Load a graph built with makeGraphWithBeliefs(), then query the
     *  beliefs endpoint with the agent's node ID. Assert results are returned. */
  });
});
```

#### Validate then load workflow

```javascript
describe('Integration: validate then load', () => {
  // Test: POST /api/validate with valid graph then POST /api/graph/load succeeds
  it('validating a graph before loading it both succeed', async () => {
    /** Build a valid graph. POST to /api/validate and confirm valid: true.
     *  Then POST the same graph to /api/graph/load and confirm 200 with id and stats. */
  });

  // Test: POST /api/validate with invalid graph returns errors, POST /api/graph/load also rejects
  it('invalid graph is rejected by both validate and load endpoints', async () => {
    /** Build an invalid graph (e.g., missing required fields). POST to /api/validate
     *  and assert valid: false with errors array. Then POST to /api/graph/load
     *  and assert 400 response. Both endpoints should agree on invalidity. */
  });
});
```

#### Scenario-to-validation round trip

```javascript
describe('Integration: scenario graph validation', () => {
  // Test: GET /api/scenarios returns list, pick first, GET /api/scenarios/:id, validate its graph
  it('scenario constructed graph passes validation', async () => {
    /** GET /api/scenarios to obtain a list. Take the first scenario ID.
     *  GET /api/scenarios/:id to retrieve the full scenario with its constructed graph.
     *  POST the graph to /api/validate. Assert valid: true.
     *  This confirms the scenario loader builds valid MPCG graphs. */
  });

  // Test: scenario graph can be loaded into the graph store and queried
  it('scenario graph can be loaded and queried for stats', async () => {
    /** GET a scenario with its graph. POST graph to /api/graph/load.
     *  Then GET /api/graph/:id/stats and assert stats contain node/edge counts
     *  matching the scenario's entityCount and relationshipCount. */
  });
});
```

#### Error response consistency

```javascript
describe('Integration: error format consistency', () => {
  // Test: 404 from /api/graph/:id/stats uses RFC 7807 format
  it('graph 404 returns RFC 7807 format', async () => {
    /** GET /api/graph/nonexistent-id/stats. Assert 404 response body has
     *  type, title, status, detail properties. Assert Content-Type includes
     *  application/problem+json. */
  });

  // Test: 404 from /api/scenarios/:id uses RFC 7807 format
  it('scenario 404 returns RFC 7807 format', async () => {
    /** GET /api/scenarios/nonexistent-id. Assert same RFC 7807 structure. */
  });

  // Test: 400 from /api/validate uses RFC 7807 format
  it('validation 400 returns RFC 7807 format', async () => {
    /** POST /api/validate with empty body (no graph property). Assert 400
     *  with RFC 7807 structure. */
  });

  // Test: 400 from /api/graph/load uses RFC 7807 format
  it('graph load 400 returns RFC 7807 format', async () => {
    /** POST /api/graph/load with empty body. Assert 400 with RFC 7807 structure. */
  });

  // Test: unknown route returns 404 with RFC 7807 format
  it('unknown route returns RFC 7807 404', async () => {
    /** GET /api/nonexistent. Assert 404 with type, title, status, detail. */
  });

  // Test: malformed JSON body returns 400 with RFC 7807 format (not crash)
  it('malformed JSON returns RFC 7807 400', async () => {
    /** POST /api/validate with Content-Type: application/json but invalid JSON string.
     *  Assert 400 with RFC 7807 structure. No stack trace in response. */
  });
});
```

#### STIG compliance verification

```javascript
describe('Integration: STIG compliance', () => {
  // Test: 500 errors do not leak stack traces or file paths (V-222610)
  it('internal errors return generic message without stack traces', async () => {
    /** Create an app with a custom route that throws an unhandled Error.
     *  Make a request to that route. Assert 500 response body has
     *  generic detail text, does not contain file paths (no '/packages/'),
     *  does not contain 'Error:' or 'at ' stack trace markers. */
  });

  // Test: all error responses use application/problem+json content type
  it('all error responses use problem+json content type', async () => {
    /** Trigger multiple error conditions (404, 400, malformed JSON).
     *  For each, assert the Content-Type header contains application/problem+json. */
  });
});
```

#### Cross-route data consistency

```javascript
describe('Integration: cross-route data consistency', () => {
  // Test: taxonomy node types are accepted by graph validation
  it('taxonomy node types are valid in graph nodes', async () => {
    /** GET /api/types/nodes to retrieve the list of valid node types.
     *  Pick one type name. Construct a minimal graph with a node of that type.
     *  POST to /api/validate and assert the type is accepted (valid: true or
     *  no error about invalid node type). */
  });

  // Test: constraint edge types match taxonomy edge types
  it('constraint domain-range edge types exist in taxonomy', async () => {
    /** GET /api/constraints/domain-range to get rules.
     *  GET /api/types/edges to get all valid edge types.
     *  Assert every edgeType referenced in domain-range rules exists
     *  in the edge types list. */
  });

  // Test: constraint algebra causal edges match taxonomy edge types
  it('algebra causal edge types exist in taxonomy', async () => {
    /** GET /api/constraints/algebra.
     *  GET /api/types/edges.
     *  Assert every causalEdge exists in the edge types list. */
  });
});
```

---

## Implementation Details

### Test file: `packages/api/tests/integration.test.js`

This is a single test file containing all integration tests. Each test creates a fresh app via `createApp()` to ensure test isolation (no shared graph store state between tests).

#### Key patterns

**Fresh app per test:** Each test (or describe block) should call `createApp()` to get a clean app instance with an empty graph store. This prevents test ordering dependencies.

**Workflow assertions:** Integration tests are distinguished from unit tests by asserting on multi-step workflows. For example, loading a graph and then querying it is a single logical test case, not two separate assertions.

**RFC 7807 assertion helper:** Since many tests check for the RFC 7807 format, consider defining a small helper within the test file:

```javascript
function assertRFC7807(response, expectedStatus) {
  /** Assert the response has the expected status code, Content-Type includes
   *  'application/problem+json', and body contains type, title, status, detail.
   *  Assert body.status matches expectedStatus. */
}
```

This is a local utility within the test file, not a shared fixture.

**Scenario tests assume scenarios exist on disk:** The scenario integration tests depend on actual scenario files being present at the expected path (`MPCG_PROJECT_DIR/src/scenarios/`). If the test environment does not have scenarios, these tests will naturally skip or fail. The `createApp()` factory accepts a `scenarioDir` option that could be used to point at a test fixtures directory if needed.

**STIG 500 error test:** To trigger a genuine 500 error, inject a route into the app that throws an unhandled error before passing the app to supertest. For example, add a test-only route:

```javascript
const app = createApp();
app.get('/api/test-error', (req, res, next) => { throw new Error('test internal error'); });
```

Then request `/api/test-error` and verify the response has status 500, a generic detail message, and no stack trace content (no substrings like `at `, no file paths containing `/packages/` or `.js:`).

### Test execution

The integration test file follows the existing naming pattern and will be picked up automatically by the test command:

```bash
pnpm --filter @mpcg/api test
# resolves to: node --test tests/*.test.js
# includes: tests/integration.test.js
```

### What to verify in each test category

**Full lifecycle tests** confirm that the graph store works correctly across load/query/delete operations. The graph loaded via POST should produce identical stats when queried via GET. After DELETE, the graph should be gone.

**Validate-then-load tests** confirm that the validate and load endpoints agree on graph validity. A graph that passes validation should also load successfully, and vice versa.

**Scenario round-trip tests** confirm that the scenario loader produces valid MPCG graphs. This is a critical end-to-end check -- it verifies that `lib/scenarios.js` graph construction (section-04) produces output that passes `@mpcg/core` validation.

**Error format consistency tests** confirm that every route that returns errors uses the same RFC 7807 format. This prevents inconsistencies where some routes return `{ error: "..." }` and others return `{ type, title, status, detail }`.

**STIG compliance tests** confirm that error responses never leak internal implementation details. The key check is that 500 responses contain only a generic message, not stack traces or file paths.

**Cross-route data consistency tests** confirm that the taxonomy/types endpoints, constraint endpoints, and validation endpoint all agree on what constitutes valid type names. If a type appears in the taxonomy, it should be accepted by the validator. If a constraint references an edge type, that edge type should exist in the taxonomy.