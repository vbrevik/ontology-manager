# @mpcg/core — Complete Specification

## Overview

Package the existing MPCG schema, taxonomy, validator, and graph engine into a consumable npm module (`@mpcg/core`) within a pnpm workspace. The package enables sibling projects (API server, web frontend) to import MPCG capabilities via workspace linking.

## Package Identity

- **Name:** `@mpcg/core`
- **Consumption:** Local pnpm workspace only (not published to npm registry)
- **Module format:** ES Modules (`"type": "module"`)
- **Node.js:** 20+ (declared in `engines`)
- **Runtime dependencies:** `ajv` ^8.17.1, `ajv-formats` ^3.0.1

## Workspace Setup

The root project transitions to a pnpm workspace with `pnpm-workspace.yaml` defining `packages/*` as workspace members. The root `package.json` gains `"private": true`. Sibling packages reference `@mpcg/core` via `workspace:*` protocol.

## Exports

### Data Exports
```typescript
export const schema: MPCGSchema;        // Parsed schema.json
export const taxonomy: MPCGTaxonomy;    // Parsed taxonomy.json
export const nodeTypes: string[];       // NodeType enum values
export const edgeTypes: string[];       // EdgeType enum values
```

### Validation
```typescript
export function validate(
  graph: MPCGGraphInput,
  options?: { schema?: object; taxonomy?: object }
): ValidationResult;
```
- Default behavior: loads bundled schema.json and taxonomy.json automatically
- Optional: accepts custom schema/taxonomy objects for override scenarios
- Returns: `{ valid, errors[], warnings[], stats }`

### Graph Engine
```typescript
export class MPCGGraph {
  constructor(data: MPCGGraphInput);
  findByType(type: string): MPCGNode[];
  getNode(id: string): MPCGNode | undefined;
  outgoing(nodeId: string, edgeType?: string): MPCGEdge[];
  incoming(nodeId: string, edgeType?: string): MPCGEdge[];
  edgesOfType(type: string): MPCGEdge[];
  causalChain(startId: string, maxDepth?: number): CausalChainEntry[];
  beliefsOf(agentId: string): MPCGNode[];
  contradictions(): Contradiction[];
  provenance(nodeId: string): ProvenanceResult;
  visibleAt(classification: string, releasableTo: string[]): FilteredGraph;
  stats(): GraphStats;
}
```
- Constructor validates input via internal `validate()` call
- graph-engine.js imports its co-located validate.js internally (not parameterizable)

## Type Definitions

- Source JS files annotated with JSDoc
- TypeScript declarations generated via `tsc --allowJs --declaration --emitDeclarationOnly`
- Generated `.d.ts` files included in package output
- Types cover all public exports: schema structures, taxonomy structures, graph nodes/edges, validation results, all method signatures

### Key Types to Define
- `MPCGSchema` — the parsed schema.json structure
- `MPCGTaxonomy` — the parsed taxonomy.json structure
- `MPCGGraphInput` — input format for graph construction/validation
- `MPCGNode` — node with id, type, label, properties, security, perspective
- `MPCGEdge` — edge with source, target, type, properties, weight, confidence
- `ValidationResult` — { valid, errors, warnings, stats }
- `GraphStats` — { nodes, edges, nodeTypes, edgeTypes, perspective, security }
- `CausalChainEntry` — { node, depth }
- `Contradiction` — { a, b, edge }
- `ProvenanceResult` — { sources, evidence, assertors }
- `FilteredGraph` — { nodes, edges }

## Source Files

The package wraps four existing source files:

| Source | Export Role |
|--------|-----------|
| `src/schema.json` | Exported as `schema`, bundled for validate.js path resolution |
| `src/taxonomy.json` | Exported as `taxonomy`, bundled for validate.js path resolution |
| `src/validate.js` | Exported as `validate()`, modified to accept optional schema/taxonomy params |
| `src/graph-engine.js` | Exported as `MPCGGraph` class |

### Path Resolution

`validate.js` currently loads schema.json and taxonomy.json via `readFileSync` with `__dirname`. The package must:
1. Modify `validate()` to accept optional `{ schema, taxonomy }` parameter
2. Default to loading from `__dirname` (co-located copies in package)
3. Include copies of schema.json and taxonomy.json in the package directory
4. Build script handles copying from source to package before workspace linking

## Testing Requirements

### Existing Tests (must continue passing)
- `src/tests/graph-engine.test.js` — Integration tests with NATO intelligence scenario
- `src/tests/adversarial.test.js` — Negative/adversarial validation tests
- These stay in `src/tests/` with their existing relative imports

### New Package Tests (in packages/core/)
- **Import test:** Verify `import { validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes } from '@mpcg/core'` resolves correctly via workspace linking
- **TypeScript compilation test:** Import types and verify they compile without errors
- **Parameterized validation test:** Verify `validate(graph, { schema, taxonomy })` works with custom schema/taxonomy objects

## Success Criteria

1. `pnpm install` in root sets up workspace with @mpcg/core linked
2. `import { validate, MPCGGraph, schema } from '@mpcg/core'` works from any workspace package
3. All 22 existing tests pass unchanged
4. New package import tests pass
5. TypeScript types are available and compile for all exports
6. `validate()` works both with default (filesystem) and injected schema/taxonomy
