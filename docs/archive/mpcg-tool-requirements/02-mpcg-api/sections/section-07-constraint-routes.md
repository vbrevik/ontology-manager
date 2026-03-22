Now I have all the context needed. Let me generate the section content.

# Section 07: Constraint Routes

## Overview

This section implements two read-only endpoints that expose structural constraint metadata about the MPCG ontology: domain/range rules for edge types and algebraic properties of edges. These constraints are defined as static data within `packages/api/lib/constraints.js` and served via routes in `packages/api/routes/constraints.js`.

**Dependencies:** This section depends on section-01 (package setup, app factory) and section-02 (error handling). The routes are mounted by the app factory created in section-01.

## Files to Create

| File | Purpose |
|------|---------|
| `packages/api/lib/constraints.js` | Static constraint data definitions (domain/range rules, algebraic properties) |
| `packages/api/routes/constraints.js` | Express router for `/api/constraints/*` endpoints |
| `packages/api/tests/constraints.test.js` | Tests for constraint routes |

## Tests First

Create `packages/api/tests/constraints.test.js` using Node's built-in `node:test` and `node:assert/strict` with `supertest`. Import `createApp` from `../app.js` and pass the resulting app to supertest.

The following test stubs define the required behavior:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import createApp from '../app.js';

const app = createApp();

describe('GET /api/constraints/domain-range', () => {
  // Test: returns 200 with a rules array
  // Test: rules include agent-requiring edge types (believes, knows, decides, intends, assumes, doubts, feels, commands, operational_control, tactical_control)
  // Test: rules include place-requiring edge type (located_at) with constraint "target"
  // Test: rules include measurement-requiring edge type (measures) with constraint "source"
  // Test: all edge types referenced in rules are valid per @mpcg/core edgeTypes export
});

describe('GET /api/constraints/algebra', () => {
  // Test: returns 200 with causalEdges array
  // Test: causalEdges includes known causal types (causes, enables, transforms, disrupts, amplifies, cascades_to, overwhelms)
  // Test: response includes symmetricEdges, inversePairs, transitiveEdges keys
  // Test: symmetricEdges is an array, inversePairs is an array, transitiveEdges is an array
});
```

### Test Details

**Domain/range rule validation against core:** Import `edgeTypes` from `@mpcg/core` and verify that every edge type string appearing in any rule's `edgeTypes` array is present in the core `edgeTypes` list. This ensures constraint data stays in sync with the ontology.

**Response shape for domain-range:** The response body must have a `rules` property that is an array. Each rule object must have these properties:
- `edgeTypes` (array of strings) -- the edge type names this rule applies to
- `constraint` (string, either `"source"` or `"target"`) -- which end of the edge is constrained
- `requiredSupertype` (string) -- the taxonomy supertype that the constrained node must be a subtype of
- `description` (string) -- human-readable explanation of the rule

**Response shape for algebra:** The response body must have these four properties, all arrays:
- `causalEdges` -- string array of edge types followed by `causalChain`
- `symmetricEdges` -- string array (may be empty if not formally defined in the ontology)
- `inversePairs` -- array of `[string, string]` pairs (may be empty)
- `transitiveEdges` -- string array (may be empty)

## Implementation: lib/constraints.js

This module exports two functions that return static constraint data. No dynamic computation is needed -- these are hand-curated lists derived from the MPCG ontology's validation rules.

### getDomainRangeRules()

Returns an object `{ rules: [...] }` containing three rule entries:

**Rule 1 -- Agent-requiring edges (source constraint):**
- `edgeTypes`: `["decides", "intends", "believes", "knows", "assumes", "doubts", "feels", "commands", "operational_control", "tactical_control"]`
- `constraint`: `"source"`
- `requiredSupertype`: `"Agent"`
- `description`: A string explaining that the source node must be an Agent subtype

**Rule 2 -- Place-requiring edges (target constraint):**
- `edgeTypes`: `["located_at"]`
- `constraint`: `"target"`
- `requiredSupertype`: `"Place"`
- `description`: A string explaining that the target node must be a Place subtype

**Rule 3 -- Measurement-requiring edges (source constraint):**
- `edgeTypes`: `["measures"]`
- `constraint`: `"source"`
- `requiredSupertype`: `"Measurement"`
- `description`: A string explaining that the source node must be a Measurement/Metric/Rating/Threshold subtype

### getAlgebraicProperties()

Returns an object with four arrays:

- `causalEdges`: `["causes", "enables", "transforms", "disrupts", "amplifies", "cascades_to", "overwhelms"]` -- these are the edge types that the `MPCGGraph.causalChain()` method follows during traversal
- `symmetricEdges`: `[]` -- empty array; no symmetric edges are formally defined in the current ontology
- `inversePairs`: `[]` -- empty array; no inverse pairs are formally defined
- `transitiveEdges`: `[]` -- empty array; no transitive edges are formally defined

The empty arrays are intentional. The algebraic properties are not yet formally specified in the MPCG ontology. The endpoint structure is in place so that when they are defined, only the static data in this file needs to change.

## Implementation: routes/constraints.js

This module exports an Express router with two GET routes.

### Router Setup

Create an Express `Router`. Import `getDomainRangeRules` and `getAlgebraicProperties` from `../lib/constraints.js`.

### GET /api/constraints/domain-range

Handler calls `getDomainRangeRules()` and returns the result as JSON with status 200. No parameters, no validation needed -- this is a static data endpoint.

### GET /api/constraints/algebra

Handler calls `getAlgebraicProperties()` and returns the result as JSON with status 200. No parameters, no validation needed.

### Route Mounting

The router is mounted at `/api/constraints` in the app factory (`app.js` from section-01). The app factory must import this router and call:

```javascript
app.use('/api/constraints', constraintsRouter);
```

This line should be added alongside the other route mounts in `createApp()`. The constraints router does not depend on the graph store or scenario directory, so no dependency injection is needed.

## Edge Type Reference

For implementer convenience, here are the edge types grouped by constraint category. These are derived from the `@mpcg/core` validation logic in `packages/core/validate.js`:

**Agent-requiring (source must be Agent subtype):** `decides`, `intends`, `believes`, `knows`, `assumes`, `doubts`, `feels`, `commands`, `operational_control`, `tactical_control`

**Place-requiring (target must be Place subtype):** `located_at`

**Measurement-requiring (source must be Measurement subtype):** `measures`

**Causal (followed by causalChain traversal):** `causes`, `enables`, `transforms`, `disrupts`, `amplifies`, `cascades_to`, `overwhelms`

## Checklist

1. Create `packages/api/tests/constraints.test.js` with all test stubs listed above
2. Create `packages/api/lib/constraints.js` with `getDomainRangeRules()` and `getAlgebraicProperties()` exports
3. Create `packages/api/routes/constraints.js` with the Express router and two GET route handlers
4. Add the constraints router mount to `packages/api/app.js` (line: `app.use('/api/constraints', constraintsRouter)`)
5. Run tests: `pnpm --filter @mpcg/api test` and verify all constraint tests pass
6. Verify that all edge types in the rules exist in `@mpcg/core`'s `edgeTypes` export (this is also covered by the test suite)