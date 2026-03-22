# @mpcg/core Usage Guide

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the package (copies data files + generates TypeScript declarations)
pnpm --filter @mpcg/core build

# Run all tests
pnpm --filter @mpcg/core test

# Verify TypeScript types
pnpm --filter @mpcg/core test:types
```

## Importing

```javascript
import { validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes } from '@mpcg/core';
```

## Validating a Graph

```javascript
import { validate } from '@mpcg/core';

const graph = {
  id: crypto.randomUUID(),
  nodes: [
    { id: crypto.randomUUID(), type: 'Person', label: 'Alice' },
    { id: crypto.randomUUID(), type: 'Event', label: 'Meeting' },
  ],
  edges: [
    { source: '<alice-id>', target: '<meeting-id>', type: 'participates_in' },
  ],
  domain: 'example',
  perspective: { agent_id: crypto.randomUUID() },
};

const result = validate(graph);
// result.valid: boolean
// result.errors: string[]
// result.warnings: string[]
// result.stats: { nodes, edges, nodeTypes, edgeTypes, errors, warnings }
```

### With Custom Schema/Taxonomy

```javascript
import { validate, schema, taxonomy } from '@mpcg/core';

const result = validate(graph, { schema: myCustomSchema, taxonomy: myCustomTaxonomy });
```

## Using the Graph Engine

```javascript
import { MPCGGraph } from '@mpcg/core';

const graph = new MPCGGraph(validGraphData);

// Query nodes
graph.findByType('Person');       // MPCGNode[]
graph.getNode('node-id');          // MPCGNode | undefined

// Query edges
graph.outgoing('node-id');         // MPCGEdge[]
graph.incoming('node-id', 'causes'); // filtered by edge type
graph.edgesOfType('believes');     // MPCGEdge[]

// Analysis
graph.causalChain('start-id');     // CausalChainEntry[]
graph.beliefsOf('agent-id');       // MPCGNode[]
graph.contradictions();            // Contradiction[]
graph.provenance('node-id');       // ProvenanceResult

// Security
graph.visibleAt('KONFIDENSIELT'); // FilteredGraph

// Statistics
graph.stats();
// { nodes: number, edges: number, nodeTypes: string[], edgeTypes: string[] }
```

## Exported Constants

```javascript
import { schema, taxonomy, nodeTypes, edgeTypes } from '@mpcg/core';

// schema: Full JSON Schema object
// taxonomy: Full taxonomy with node/edge type hierarchies
// nodeTypes: string[] — all valid node type names
// edgeTypes: string[] — all valid edge type names
```

## TypeScript Support

The package ships with generated `.d.ts` files. All public types are available:

```typescript
import { validate, MPCGGraph } from '@mpcg/core';

// Types are inferred from function signatures
const result = validate(graphData);  // ValidationResult
const graph = new MPCGGraph(data);   // MPCGGraph instance
```

## Build Pipeline

```
pnpm --filter @mpcg/core build
  1. prebuild → clean (removes types/, schema.json, taxonomy.json)
  2. build → node scripts/build.js (copies data files from src/)
  3. build → tsc (generates .d.ts into types/)
```
