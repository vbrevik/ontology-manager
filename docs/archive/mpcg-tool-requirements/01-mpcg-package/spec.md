# 01-mpcg-package — npm Package Spec

## Overview

Package the existing MPCG schema, taxonomy, validator, and graph engine into a publishable npm module that other projects can import.

## Package Name

`@mpcg/core` (or `mpcg-core` if not using scoped packages)

## Exports

```typescript
// Schema and taxonomy as parsed JSON
export const schema: MPCGSchema;
export const taxonomy: MPCGTaxonomy;

// Node and edge type enums
export const nodeTypes: string[];
export const edgeTypes: string[];

// Validator
export function validate(graph: MPCGGraphInput): ValidationResult;

// Graph engine
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

// Type definitions
export interface MPCGNode { id: string; type: string; label: string; ... }
export interface MPCGEdge { source: string; target: string; type: string; ... }
export interface ValidationResult { valid: boolean; errors: string[]; warnings: string[]; stats: object; }
// ... etc
```

## Source Files to Package

| Existing file | Package role |
|--------------|-------------|
| `src/schema.json` | Exported as `schema` |
| `src/taxonomy.json` | Exported as `taxonomy` |
| `src/validate.js` | Exported as `validate()` |
| `src/graph-engine.js` | Exported as `MPCGGraph` class |

## Build

- ES module output (type: "module")
- TypeScript declaration files (.d.ts) generated from JSDoc or hand-written
- No build step for JS (already ES modules) — just re-export with proper package.json

## Package Structure

```
packages/core/
├── package.json
├── index.js          ← re-exports from src/
├── index.d.ts        ← TypeScript type definitions
├── schema.json       ← copied or symlinked
├── taxonomy.json     ← copied or symlinked
├── validate.js       ← from src/validate.js
├── graph-engine.js   ← from src/graph-engine.js
└── types/
    ├── schema.d.ts   ← generated or hand-written types for graph structures
    └── taxonomy.d.ts ← type hierarchy as TypeScript types
```

## Tests

- Existing 22 tests (adversarial + graph-engine) must pass when run against the package
- Add: package import test (import from package name, verify exports)
- Add: TypeScript compilation test (import types, verify they compile)

## Dependencies

- `ajv` + `ajv-formats` (for validation)
- No other runtime dependencies

## Success Criteria

1. `npm install @mpcg/core` works
2. `import { validate, MPCGGraph, schema } from '@mpcg/core'` works
3. All 22 existing tests pass
4. TypeScript types are available for all exports
