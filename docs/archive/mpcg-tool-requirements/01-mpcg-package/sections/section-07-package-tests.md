Now I have enough context to write the section.

# Section 7: Package Tests

## Overview

This section creates the test suite for the `@mpcg/core` package. It verifies that all exports are accessible via the `@mpcg/core` package name, that runtime behavior (validation, graph engine) works correctly through the package interface, and that generated TypeScript declarations compile without errors.

**Dependencies:** This section requires completion of:
- Section 03 (validate.js parameterization -- needed for custom schema/taxonomy tests)
- Section 05 (TypeScript pipeline -- needed for generated `.d.ts` files used by type tests)
- Section 06 (build scripts -- package must be built before tests can import it)

## File Manifest

| File | Action |
|------|--------|
| `packages/core/tests/package-import.test.js` | Create |
| `packages/core/tests/types.test.ts` | Create |
| `packages/core/tsconfig.test.json` | Create |
| `packages/core/package.json` | Modify (add `test` and `test:types` scripts) |

All paths are relative to the project root: `/Users/vidarbrevik/projects/universal-context-model/`

## Tests

The tests in this section ARE the deliverable -- this section is about writing the package test suite itself. The TDD checklist below describes what the test files must cover; the implementation is the test code.

### Checklist

```
# packages/core/tests/package-import.test.js exists
# Package import test can import all 6 exports from '@mpcg/core'
# Package import test validates schema structure ($defs, NodeType, EdgeType)
# Package import test validates taxonomy structure (nodeTypes, edgeTypes)
# Package import test calls validate() with a minimal valid graph
# Package import test calls validate() with custom schema/taxonomy
# Package import test constructs MPCGGraph and calls stats()
# packages/core/tests/types.test.ts exists
# tsconfig.test.json exists with paths mapping for @mpcg/core
# tsc --noEmit --project tsconfig.test.json compiles types test
# Types test imports and uses MPCGNode, MPCGEdge, ValidationResult types
```

## Implementation Details

### 1. Runtime Test: `packages/core/tests/package-import.test.js`

This file uses the Node.js built-in test framework (`node:test` with `describe`/`it`) and `node:assert`, matching the conventions in the existing `src/tests/` test files.

The file imports everything from `@mpcg/core` (the workspace-linked package name, not a relative path). This is the critical distinction from the existing `src/tests/` files which use relative imports -- these tests prove the package interface works.

**Test structure (5 test groups):**

**Test 1 -- All exports resolve.** Import `{ validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes }` from `@mpcg/core`. Assert each is defined. Assert `validate` is a function, `MPCGGraph` is a function (constructor), `schema` is a non-null object, `taxonomy` is a non-null object, `nodeTypes` is an array, `edgeTypes` is an array.

**Test 2 -- Schema and taxonomy structure.** Assert `schema.$defs` exists and has `NodeType` and `EdgeType` properties. Assert `schema.$defs.NodeType.enum` is a non-empty array. Assert `taxonomy.nodeTypes` and `taxonomy.edgeTypes` exist. Assert `nodeTypes` contains known types like `"Person"`, `"Event"`, `"Concept"`. Assert `edgeTypes` contains known types like `"causes"`, `"contains"`, `"believes"`.

**Test 3 -- validate() with defaults.** Construct a minimal valid graph object with the required fields (`id`, `nodes`, `edges`, `domain`, `perspective`). Call `validate(graph)`. Assert the result has `valid: true`.

**Test 4 -- validate() with custom schema/taxonomy.** Call `validate(graph, { schema, taxonomy })` passing the same schema and taxonomy that were exported from the package. Assert the result has `valid: true` (same graph, same schema/taxonomy should produce the same result). This exercises the parameterization from Section 03.

**Test 5 -- MPCGGraph constructs and queries.** Construct a valid graph data object with a few nodes and edges. Create `new MPCGGraph(data)`. Call `stats()` on the instance. Assert the returned object has `nodes` and `edges` count properties matching the input data.

The minimal valid graph used in tests 3-5 should follow the pattern from the existing test files. A graph needs at minimum: `id` (UUID), `nodes` (array with at least one node having `id`, `type`, `label`), `edges` (can be empty array), `domain` (string), and `perspective` (object with `agent_id`). Use `crypto.randomUUID()` for IDs as the existing tests do.

```javascript
// Stub showing structure -- NOT the full implementation
import { validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes } from '@mpcg/core';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

describe('@mpcg/core package exports', () => {
  it('exports validate as a function', () => { /* assert typeof validate === 'function' */ });
  it('exports MPCGGraph as a function', () => { /* assert typeof MPCGGraph === 'function' */ });
  it('exports schema as an object with $defs', () => { /* assert schema.$defs */ });
  it('exports taxonomy with nodeTypes and edgeTypes', () => { /* assert taxonomy.nodeTypes */ });
  it('exports nodeTypes as a non-empty string array', () => { /* assert Array.isArray, length > 0 */ });
  it('exports edgeTypes as a non-empty string array', () => { /* assert Array.isArray, length > 0 */ });
});

describe('validate() via package', () => {
  /** Build a minimal valid graph for each test */
  it('returns valid: true for a minimal valid graph', () => { /* validate(minimalGraph) */ });
  it('returns valid: true with explicit schema and taxonomy', () => { /* validate(graph, { schema, taxonomy }) */ });
});

describe('MPCGGraph via package', () => {
  it('constructs and returns correct stats', () => { /* new MPCGGraph(data).stats() */ });
});
```

### 2. TypeScript Compilation Test: `packages/core/tests/types.test.ts`

This file is never executed at runtime. It exists solely to verify that the generated `.d.ts` files export the correct types. It is compiled with `tsc --noEmit` using a dedicated tsconfig.

The file should:
- Import types from `@mpcg/core` (using the type-only import syntax where appropriate)
- Assign typed variables to exercise the type definitions
- Cover at minimum: `MPCGNode`, `MPCGEdge`, `ValidationResult`, `MPCGGraph`, `validate` function signature

```typescript
// Stub showing structure
import type { MPCGNode, MPCGEdge, ValidationResult } from '@mpcg/core';
import { validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes } from '@mpcg/core';

// Type assertions -- these lines verify the types compile correctly
const node: MPCGNode = { id: 'n1', type: 'Person', label: 'Test' };
const edge: MPCGEdge = { source: 'n1', target: 'n2', type: 'causes' };
const result: ValidationResult = validate({ id: '1', nodes: [], edges: [], domain: 'test', perspective: { agent_id: 'a' } });
const graph: MPCGGraph = new MPCGGraph({ id: '1', nodes: [], edges: [] });
const types: string[] = nodeTypes;
```

The exact type shapes (`MPCGNode`, `MPCGEdge`, `ValidationResult`) depend on the JSDoc typedefs defined in Section 04. The test should use whatever types are exported -- the point is that the assignment compiles without errors.

### 3. TypeScript Test Config: `packages/core/tsconfig.test.json`

This config is needed because a bare `tsc --noEmit tests/types.test.ts` cannot resolve the `@mpcg/core` import. The tsconfig must map the package name to the generated type declarations.

```json
{
  "compilerOptions": {
    "module": "ES2020",
    "moduleResolution": "node16",
    "target": "ES2020",
    "strict": true,
    "noEmit": true,
    "paths": {
      "@mpcg/core": ["./types/index.d.ts"]
    },
    "baseUrl": "."
  },
  "include": ["tests/types.test.ts"]
}
```

Key points:
- `paths` maps `@mpcg/core` to the generated `types/index.d.ts` so the import resolves during type checking
- `baseUrl: "."` is required for `paths` to work
- `strict: true` is intentional here (unlike the main tsconfig which uses `strict: false`) -- we want the type test to be strict to catch any `any` leakage
- `noEmit: true` means no output files are generated; this is purely a compilation check

### 4. Package.json Script Additions

Add these scripts to `packages/core/package.json` (alongside any existing scripts from Section 06):

```json
{
  "scripts": {
    "test": "node --test tests/*.test.js",
    "test:types": "tsc --noEmit --project tsconfig.test.json"
  }
}
```

These scripts are invoked via:
- `pnpm --filter @mpcg/core test` -- runs the runtime package import tests
- `pnpm --filter @mpcg/core test:types` -- runs the TypeScript compilation check

**Prerequisite:** The package must be built (`pnpm --filter @mpcg/core build`) before running either test command, because:
- The runtime tests import `@mpcg/core` which needs `schema.json`, `taxonomy.json`, and `graph-engine.js` to be present in `packages/core/`
- The type tests need `types/index.d.ts` to exist

## Relationship to Existing Tests

The existing tests in `src/tests/` are unrelated to this section. They test the source files directly via relative imports and continue to run via `pnpm test` from the root. The package tests created here test the packaged interface via the `@mpcg/core` import path, verifying that the packaging, build, and export configuration all work together correctly.

---

## Implementation Notes (Post-Implementation)

### Files Created
- `packages/core/tests/package-import.test.js` — 9 runtime tests importing via @mpcg/core
- `packages/core/tests/types.test.ts` — TypeScript compilation test (never executed at runtime)
- `packages/core/tsconfig.test.json` — Config for types.test.ts with paths mapping

### Deviations from Plan
1. **types.test.ts doesn't import MPCGNode/MPCGEdge directly** — These types aren't re-exported from index.d.ts (they're internal to validate.d.ts). The test verifies types implicitly via function parameter/return types.
2. **Graph test data uses empty edges** — Schema requires UUID format for IDs and strict validation; simplified test graphs use crypto.randomUUID() and empty edge arrays.
3. **module: "node16"** in tsconfig.test.json instead of plan's "ES2020" (tsc 5.9 requirement).

### Test Counts
- package-import.test.js: 9 runtime tests (all passing)
- types.test.ts: compiles cleanly with tsc --noEmit
- Total project tests: 64 (all passing)