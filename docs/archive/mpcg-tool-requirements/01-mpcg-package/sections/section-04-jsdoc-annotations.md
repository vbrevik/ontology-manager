Now I have all the context I need. Let me generate the section content.

# Section 4: JSDoc Annotations

## Overview

Add JSDoc `@typedef`, `@param`, and `@returns` annotations to `validate.js` and `graph-engine.js` in `packages/core/`. These annotations enable `tsc` (configured in Section 5) to generate accurate `.d.ts` type declaration files. Also annotate `index.js` so all re-exported symbols carry type information.

**Dependencies:** Section 2 (package structure and entry point must exist), Section 3 (validate.js parameterization must be complete, since annotations must reflect the new `options` parameter).

**Blocks:** Section 5 (TypeScript generation pipeline relies on JSDoc annotations being present to produce meaningful `.d.ts` output).

## Tests (Write First)

These tests verify JSDoc correctness by running `tsc` against the annotated files and checking the output. Create a test script or run these checks manually before proceeding to Section 5.

File: `packages/core/tests/jsdoc-check.test.js`

```
# Test: tsc --noEmit runs against validate.js without type errors
# Test: tsc --noEmit runs against graph-engine.js without type errors
# Test: tsc --noEmit runs against index.js without type errors
# Test: All @typedef types are referenced by at least one @param or @returns
# Test: MPCGGraph class has JSDoc on constructor and all 11 public methods
# Test: validate function has JSDoc with correct parameter and return types
# Test: ValidationResult and ValidationStats are distinct types
# Test: GraphStats type has nodeTypes as string[] (not number)
```

Verification approach: Use `tsc --noEmit --allowJs --checkJs` pointed at each file to confirm JSDoc parses without errors. Use grep or a simple script to verify every `@typedef` name appears in at least one `@param` or `@returns` annotation. The distinction between `ValidationStats` (counts: `nodeTypes: number`) and `GraphStats` (arrays: `nodeTypes: string[]`) is critical and must be verified.

A minimal test file using `node:test`:

```javascript
// packages/core/tests/jsdoc-check.test.js
import { describe, it } from 'node:test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreDir = join(__dirname, '..');

describe('JSDoc annotations', () => {
  it('tsc --noEmit runs against validate.js without type errors', () => {
    // Runs tsc with allowJs/checkJs against validate.js
    // Expects zero exit code
  });

  it('tsc --noEmit runs against graph-engine.js without type errors', () => {
    // Same for graph-engine.js
  });

  it('tsc --noEmit runs against index.js without type errors', () => {
    // Same for index.js
  });

  it('all @typedef types are referenced by at least one @param or @returns', () => {
    // Read validate.js and graph-engine.js
    // Extract all @typedef names via regex
    // Check each name appears in @param or @returns somewhere in the same file
  });

  it('MPCGGraph class has JSDoc on constructor and all 11 public methods', () => {
    // Read graph-engine.js, find all method definitions
    // Verify each is preceded by a JSDoc comment block
  });

  it('validate function has JSDoc with correct parameter and return types', () => {
    // Read validate.js, find the validate function
    // Verify @param {MPCGGraphInput} graph and @param {ValidateOptions} [options]
    // Verify @returns {ValidationResult}
  });

  it('ValidationResult and ValidationStats are distinct types', () => {
    // Read validate.js, extract both typedef blocks
    // Verify ValidationStats has nodeTypes: number, edgeTypes: number
    // Verify ValidationResult has stats: ValidationStats
  });

  it('GraphStats type has nodeTypes as string[] (not number)', () => {
    // Read graph-engine.js, extract GraphStats typedef
    // Verify nodeTypes is string[], edgeTypes is string[]
  });
});
```

## Types to Define

The following types must be defined as JSDoc `@typedef` blocks. Each type is placed in the file where it is most relevant.

### Types in `validate.js`

**`MPCGGraphInput`** -- the raw graph JSON structure passed to `validate()`:
- `id` (string)
- `nodes` (MPCGNode[])
- `edges` (MPCGEdge[])
- `perspective` (object, optional) -- perspective metadata
- `security` (object, optional) -- security classification block
- `operational_mode` (string, optional)

**`MPCGNode`** -- a node in the graph:
- `id` (string)
- `type` (string)
- `label` (string)
- `properties` (Object, optional) -- freeform properties bag
- `security` (object, optional) -- node-level security labels
- `perspective` (object, optional) -- perspective metadata
- `encoding_completeness` (string, optional) -- "full" | "partial" | "stub"

**`MPCGEdge`** -- an edge in the graph:
- `source` (string) -- source node ID
- `target` (string) -- target node ID
- `type` (string) -- edge type from taxonomy
- `properties` (Object, optional)
- `weight` (number, optional) -- 0 to 1
- `confidence` (number, optional)
- `security` (object, optional)

**`ValidateOptions`** -- optional second parameter to `validate()`:
- `schema` (object, optional) -- parsed JSON Schema to use instead of default
- `taxonomy` (object, optional) -- parsed taxonomy to use instead of default

**`ValidationStats`** -- statistics returned inside `ValidationResult`:
- `nodes` (number) -- count of nodes
- `edges` (number) -- count of edges
- `nodeTypes` (number) -- count of **distinct** node types (this is a **count**, not an array)
- `edgeTypes` (number) -- count of **distinct** edge types (this is a **count**, not an array)
- `errors` (number)
- `warnings` (number)

**`ValidationResult`** -- return value of `validate()`:
- `valid` (boolean)
- `errors` (string[])
- `warnings` (string[])
- `stats` (ValidationStats)

### Types in `graph-engine.js`

**`GraphStats`** -- return value of `MPCGGraph.stats()`:
- `nodes` (number)
- `edges` (number)
- `nodeTypes` (string[]) -- array of type **names** (this is an **array**, not a count; distinct from ValidationStats)
- `edgeTypes` (string[]) -- array of type **names**
- `perspective` (object, optional)
- `security` (string, optional) -- classification string

**`CausalChainEntry`** -- item in the array returned by `causalChain()`:
- `node` (MPCGNode)
- `depth` (number)

**`Contradiction`** -- item in the array returned by `contradictions()`:
- `a` (MPCGNode)
- `b` (MPCGNode)
- `edge` (MPCGEdge)

**`ProvenanceResult`** -- return value of `provenance()`:
- `sources` (MPCGNode[])
- `evidence` (MPCGNode[])
- `assertors` (MPCGNode[])

**`FilteredGraph`** -- return value of `visibleAt()`:
- `nodes` (MPCGNode[])
- `edges` (MPCGEdge[])

### Types in `index.js`

No new types needed in `index.js`. It re-exports types from validate.js and graph-engine.js. The exported constants (`schema`, `taxonomy`, `nodeTypes`, `edgeTypes`) need `@type` annotations:

- `schema` -- `@type {object}` (the full JSON Schema object)
- `taxonomy` -- `@type {object}` (the full taxonomy object)
- `nodeTypes` -- `@type {string[]}`
- `edgeTypes` -- `@type {string[]}`

## Implementation Details

### File: `packages/core/validate.js`

Add `@typedef` blocks at the top of the file, after the existing file-level JSDoc comment and before the imports. The `validate` function (which already has its `options` parameter from Section 3) gets `@param` and `@returns` annotations.

JSDoc pattern for the function:

```javascript
/**
 * @typedef {{ id: string, type: string, label: string, properties?: Object, security?: Object, perspective?: Object, encoding_completeness?: string }} MPCGNode
 */

/**
 * @typedef {{ source: string, target: string, type: string, properties?: Object, weight?: number, confidence?: number, security?: Object }} MPCGEdge
 */

/**
 * @typedef {{ id: string, nodes: MPCGNode[], edges: MPCGEdge[], perspective?: Object, security?: Object, operational_mode?: string }} MPCGGraphInput
 */

/**
 * @typedef {{ schema?: object, taxonomy?: object }} ValidateOptions
 */

/**
 * @typedef {{ nodes: number, edges: number, nodeTypes: number, edgeTypes: number, errors: number, warnings: number }} ValidationStats
 */

/**
 * @typedef {{ valid: boolean, errors: string[], warnings: string[], stats: ValidationStats }} ValidationResult
 */

/**
 * Validates an MPCG context graph against schema, taxonomy, and formal constraints.
 * @param {MPCGGraphInput} graph
 * @param {ValidateOptions} [options]
 * @returns {ValidationResult}
 */
function validate(graph, options = {}) { ... }
```

### File: `packages/core/graph-engine.js`

Add `@typedef` blocks at the top of the file. Since `graph-engine.js` imports from `validate.js`, the `MPCGNode` and `MPCGEdge` types can be imported via JSDoc's `@import` or referenced with `import()` syntax. However, the simplest approach for `tsc` compatibility is to use `import('./validate.js')` type references:

```javascript
/**
 * @typedef {import('./validate.js').MPCGNode} MPCGNode
 * @typedef {import('./validate.js').MPCGEdge} MPCGEdge
 * @typedef {import('./validate.js').MPCGGraphInput} MPCGGraphInput
 */
```

Then define the graph-engine-specific types:

```javascript
/**
 * @typedef {{ nodes: number, edges: number, nodeTypes: string[], edgeTypes: string[], perspective?: Object, security?: string }} GraphStats
 */

/**
 * @typedef {{ node: MPCGNode, depth: number }} CausalChainEntry
 */

/**
 * @typedef {{ a: MPCGNode, b: MPCGNode, edge: MPCGEdge }} Contradiction
 */

/**
 * @typedef {{ sources: MPCGNode[], evidence: MPCGNode[], assertors: MPCGNode[] }} ProvenanceResult
 */

/**
 * @typedef {{ nodes: MPCGNode[], edges: MPCGEdge[] }} FilteredGraph
 */
```

Annotate the `MPCGGraph` class and all 11 public methods. The constructor and each method need `@param` and `@returns`:

```javascript
export class MPCGGraph {
  /**
   * @param {MPCGGraphInput} data
   */
  constructor(data) { ... }

  /**
   * Find nodes by type.
   * @param {string} type
   * @returns {MPCGNode[]}
   */
  findByType(type) { ... }

  /**
   * Get a node by ID.
   * @param {string} id
   * @returns {MPCGNode | undefined}
   */
  getNode(id) { ... }

  /**
   * Get outgoing edges from a node, optionally filtered by edge type.
   * @param {string} nodeId
   * @param {string} [edgeType]
   * @returns {MPCGEdge[]}
   */
  outgoing(nodeId, edgeType) { ... }

  /**
   * Get incoming edges to a node, optionally filtered by edge type.
   * @param {string} nodeId
   * @param {string} [edgeType]
   * @returns {MPCGEdge[]}
   */
  incoming(nodeId, edgeType) { ... }

  /**
   * Find all edges of a given type.
   * @param {string} type
   * @returns {MPCGEdge[]}
   */
  edgesOfType(type) { ... }

  /**
   * Follow a causal chain from a node (BFS).
   * @param {string} startId
   * @param {number} [maxDepth=10]
   * @returns {CausalChainEntry[]}
   */
  causalChain(startId, maxDepth = 10) { ... }

  /**
   * Find all beliefs held by an agent.
   * @param {string} agentId
   * @returns {MPCGNode[]}
   */
  beliefsOf(agentId) { ... }

  /**
   * Find contradictions -- pairs of nodes connected by 'contradicts'.
   * @returns {Contradiction[]}
   */
  contradictions() { ... }

  /**
   * Find all provenance for a node.
   * @param {string} nodeId
   * @returns {ProvenanceResult}
   */
  provenance(nodeId) { ... }

  /**
   * Filter graph by security clearance.
   * @param {string} classification
   * @param {string} [releasableTo]
   * @returns {FilteredGraph}
   */
  visibleAt(classification, releasableTo) { ... }

  /**
   * Get graph statistics.
   * @returns {GraphStats}
   */
  stats() { ... }
}
```

### File: `packages/core/index.js`

Add `@type` annotations to the exported constants. The re-exports from `validate.js` and `graph-engine.js` carry their types automatically through the `export { ... } from '...'` syntax, so no additional annotations are needed for those.

```javascript
/** @type {object} */
const schema = JSON.parse(readFileSync(join(__dirname, 'schema.json'), 'utf-8'));

/** @type {object} */
const taxonomy = JSON.parse(readFileSync(join(__dirname, 'taxonomy.json'), 'utf-8'));

/** @type {string[]} */
const nodeTypes = schema.$defs.NodeType.enum;

/** @type {string[]} */
const edgeTypes = schema.$defs.EdgeType.enum;
```

### What NOT to Annotate

- Private/internal fields on MPCGGraph: `_outgoing`, `_incoming`, `_byType`, `_edgesByType` -- these are implementation details
- The `buildAncestry` helper function in validate.js -- it is not part of the public API
- The `isSubtype` helper function inside validate -- internal to the validation logic
- The CLI execution block at the bottom of the original `src/validate.js` (this block is removed in the packaged version per Section 3)
- Any module-level cached state variables (AJV instances, ancestry maps)

### Critical Distinction: ValidationStats vs GraphStats

The most important type correctness concern: `ValidationStats.nodeTypes` is a **number** (count of distinct types), while `GraphStats.nodeTypes` is a **string[]** (array of type names). This mirrors the actual runtime behavior:

- `validate()` returns `stats.nodeTypes = new Set(graph.nodes.map(n => n.type)).size` -- a number
- `MPCGGraph.stats()` returns `nodeTypes: [...this._byType.keys()]` -- a string array

Getting this wrong would cause downstream TypeScript consumers to have incorrect type assumptions. Verify this in the tests.

---

## Implementation Notes (Post-Implementation)

### Files Created/Modified
- `packages/core/validate.js` — Added 6 @typedef blocks + @param/@returns on validate()
- `packages/core/graph-engine.js` — Added 5 @typedef blocks (3 imports + 5 new) + JSDoc on constructor and all 11 public methods
- `packages/core/index.js` — Added @type annotations on 4 exported constants
- `packages/core/tests/jsdoc-check.test.js` — New, 6 test cases
- `packages/core/tsconfig.jsdoc-check.json` — New, used by tests for tsc --noEmit --checkJs

### Deviations from Plan
1. **ValidationResult.stats made required** (plan originally said required, early return path didn't include it). Fixed: early return now synthesizes zeroed stats object.
2. **tsc tests consolidated** into single tsconfig-based check instead of 3 separate per-file tests. Rationale: cleaner, error output still shows filenames.
3. **@ts-expect-error** used on ajv/ajv-formats imports (CJS default export not recognized under ESM checkJs). These suppress third-party type resolution issues, not JSDoc issues.

### Test Count: 6 (all passing)
- tsc --noEmit against all core files
- All @typedef types referenced by @param/@returns
- MPCGGraph JSDoc on constructor + 11 methods
- validate() correct @param/@returns
- ValidationResult/ValidationStats distinct types
- GraphStats.nodeTypes is string[] (not number)