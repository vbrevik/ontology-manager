diff --git a/packages/core/tests/package-import.test.js b/packages/core/tests/package-import.test.js
new file mode 100644
index 0000000..14fce1b
--- /dev/null
+++ b/packages/core/tests/package-import.test.js
@@ -0,0 +1,96 @@
+/**
+ * Package import tests for @mpcg/core
+ *
+ * These tests import via the '@mpcg/core' package name (not relative paths)
+ * to verify the package interface works correctly through pnpm workspace linking.
+ */
+import { describe, it } from 'node:test';
+import assert from 'node:assert/strict';
+import crypto from 'node:crypto';
+import { validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes } from '@mpcg/core';
+
+// Minimal valid graph for testing — uses UUIDs as required by schema
+function makeGraph(overrides = {}) {
+  return {
+    id: crypto.randomUUID(),
+    nodes: [
+      { id: crypto.randomUUID(), type: 'Person', label: 'Alice' },
+      { id: crypto.randomUUID(), type: 'Event', label: 'Meeting' },
+    ],
+    edges: [],
+    domain: 'test',
+    perspective: { agent_id: crypto.randomUUID() },
+    ...overrides,
+  };
+}
+
+describe('@mpcg/core package exports', () => {
+  it('exports validate as a function', () => {
+    assert.strictEqual(typeof validate, 'function');
+  });
+
+  it('exports MPCGGraph as a constructor', () => {
+    assert.strictEqual(typeof MPCGGraph, 'function');
+  });
+
+  it('exports schema with $defs containing NodeType and EdgeType', () => {
+    assert.ok(schema);
+    assert.ok(schema.$defs);
+    assert.ok(schema.$defs.NodeType);
+    assert.ok(schema.$defs.EdgeType);
+    assert.ok(Array.isArray(schema.$defs.NodeType.enum));
+    assert.ok(schema.$defs.NodeType.enum.length > 0);
+  });
+
+  it('exports taxonomy with nodeTypes and edgeTypes', () => {
+    assert.ok(taxonomy);
+    assert.ok(taxonomy.nodeTypes);
+    assert.ok(taxonomy.edgeTypes);
+  });
+
+  it('exports nodeTypes containing known types', () => {
+    assert.ok(Array.isArray(nodeTypes));
+    assert.ok(nodeTypes.length > 0);
+    assert.ok(nodeTypes.includes('Person'));
+    assert.ok(nodeTypes.includes('Event'));
+    assert.ok(nodeTypes.includes('Concept'));
+  });
+
+  it('exports edgeTypes containing known types', () => {
+    assert.ok(Array.isArray(edgeTypes));
+    assert.ok(edgeTypes.length > 0);
+    assert.ok(edgeTypes.includes('causes'));
+    assert.ok(edgeTypes.includes('contains'));
+    assert.ok(edgeTypes.includes('believes'));
+  });
+});
+
+describe('validate() via package', () => {
+  it('returns valid: true for a minimal valid graph', () => {
+    const result = validate(makeGraph());
+    assert.strictEqual(result.valid, true);
+    assert.strictEqual(result.errors.length, 0);
+    assert.ok(result.stats);
+    assert.strictEqual(result.stats.nodes, 2);
+    assert.strictEqual(result.stats.edges, 0);
+  });
+
+  it('returns valid: true with explicit schema and taxonomy', () => {
+    const result = validate(makeGraph(), { schema, taxonomy });
+    assert.strictEqual(result.valid, true);
+    assert.strictEqual(result.errors.length, 0);
+  });
+});
+
+describe('MPCGGraph via package', () => {
+  it('constructs and returns correct stats', () => {
+    const data = makeGraph();
+    const graph = new MPCGGraph(data);
+    const stats = graph.stats();
+    assert.strictEqual(stats.nodes, 2);
+    assert.strictEqual(stats.edges, 0);
+    assert.ok(Array.isArray(stats.nodeTypes));
+    assert.ok(stats.nodeTypes.includes('Person'));
+    assert.ok(stats.nodeTypes.includes('Event'));
+  });
+});
diff --git a/packages/core/tests/types.test.ts b/packages/core/tests/types.test.ts
new file mode 100644
index 0000000..9f59ecb
--- /dev/null
+++ b/packages/core/tests/types.test.ts
@@ -0,0 +1,51 @@
+/**
+ * TypeScript compilation test for @mpcg/core
+ *
+ * This file is never executed at runtime. It verifies that the generated
+ * .d.ts files export correct types by compiling with tsc --noEmit.
+ */
+import { validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes } from '@mpcg/core';
+
+// Verify function signatures compile
+const result = validate({
+  id: '1',
+  nodes: [{ id: 'n1', type: 'Person', label: 'Test' }],
+  edges: [],
+});
+
+// Verify result structure
+const valid: boolean = result.valid;
+const errors: string[] = result.errors;
+const warnings: string[] = result.warnings;
+const statsNodes: number = result.stats.nodes;
+const statsNodeTypes: number = result.stats.nodeTypes;
+
+// Verify validate with options
+const result2 = validate(
+  { id: '1', nodes: [], edges: [] },
+  { schema: {}, taxonomy: {} }
+);
+
+// Verify graph construction
+const graph = new MPCGGraph({
+  id: '1',
+  nodes: [{ id: 'n1', type: 'Person', label: 'Test' }],
+  edges: [],
+});
+
+// Verify graph stats return type
+const stats = graph.stats();
+const graphNodeTypes: string[] = stats.nodeTypes;
+const graphEdgeTypes: string[] = stats.edgeTypes;
+const graphNodeCount: number = stats.nodes;
+
+// Verify exported arrays and objects
+const types: string[] = nodeTypes;
+const edgeArr: string[] = edgeTypes;
+const s: object = schema;
+const t: object = taxonomy;
+
+// Suppress unused variable warnings
+void valid; void errors; void warnings; void statsNodes; void statsNodeTypes;
+void result2; void graphNodeTypes; void graphEdgeTypes; void graphNodeCount;
+void types; void edgeArr; void s; void t;
diff --git a/packages/core/tsconfig.test.json b/packages/core/tsconfig.test.json
new file mode 100644
index 0000000..847b7be
--- /dev/null
+++ b/packages/core/tsconfig.test.json
@@ -0,0 +1,15 @@
+{
+  "compilerOptions": {
+    "module": "node16",
+    "moduleResolution": "node16",
+    "target": "ES2020",
+    "strict": true,
+    "noEmit": true,
+    "skipLibCheck": true,
+    "paths": {
+      "@mpcg/core": ["./types/index.d.ts"]
+    },
+    "baseUrl": "."
+  },
+  "include": ["tests/types.test.ts"]
+}
