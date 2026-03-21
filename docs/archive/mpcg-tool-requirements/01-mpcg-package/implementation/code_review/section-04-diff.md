diff --git a/packages/core/graph-engine.js b/packages/core/graph-engine.js
new file mode 100644
index 0000000..11e2ec3
--- /dev/null
+++ b/packages/core/graph-engine.js
@@ -0,0 +1,229 @@
+/**
+ * MPCG In-Memory Graph Engine
+ *
+ * Loads MPCG graph instances, indexes them, and supports queries.
+ * Proves the schema works with real data without external dependencies.
+ *
+ * Addresses Red Team F5: "No implementation, no validation."
+ */
+
+/**
+ * @typedef {import('./validate.js').MPCGNode} MPCGNode
+ * @typedef {import('./validate.js').MPCGEdge} MPCGEdge
+ * @typedef {import('./validate.js').MPCGGraphInput} MPCGGraphInput
+ */
+
+/**
+ * @typedef {{ nodes: number, edges: number, nodeTypes: string[], edgeTypes: string[], perspective?: Object, security?: string }} GraphStats
+ */
+
+/**
+ * @typedef {{ node: MPCGNode, depth: number }} CausalChainEntry
+ */
+
+/**
+ * @typedef {{ a: MPCGNode, b: MPCGNode, edge: MPCGEdge }} Contradiction
+ */
+
+/**
+ * @typedef {{ sources: MPCGNode[], evidence: MPCGNode[], assertors: MPCGNode[] }} ProvenanceResult
+ */
+
+/**
+ * @typedef {{ nodes: MPCGNode[], edges: MPCGEdge[] }} FilteredGraph
+ */
+
+import { validate } from "./validate.js";
+
+export class MPCGGraph {
+  /**
+   * @param {MPCGGraphInput} data
+   */
+  constructor(data) {
+    const result = validate(data);
+    if (!result.valid) {
+      throw new Error(`Invalid graph: ${result.errors.join("; ")}`);
+    }
+    this.data = data;
+    this.id = data.id;
+    this.nodes = new Map(data.nodes.map(n => [n.id, n]));
+    this.edges = data.edges;
+    this.perspective = data.perspective;
+    this.security = data.security;
+    this.operational_mode = data.operational_mode;
+
+    // Build adjacency indices
+    this._outgoing = new Map(); // nodeId -> [edges]
+    this._incoming = new Map(); // nodeId -> [edges]
+    this._byType = new Map();   // nodeType -> [nodes]
+    this._edgesByType = new Map(); // edgeType -> [edges]
+
+    for (const node of data.nodes) {
+      if (!this._byType.has(node.type)) this._byType.set(node.type, []);
+      this._byType.get(node.type).push(node);
+    }
+
+    for (const edge of data.edges) {
+      if (!this._outgoing.has(edge.source)) this._outgoing.set(edge.source, []);
+      this._outgoing.get(edge.source).push(edge);
+      if (!this._incoming.has(edge.target)) this._incoming.set(edge.target, []);
+      this._incoming.get(edge.target).push(edge);
+      if (!this._edgesByType.has(edge.type)) this._edgesByType.set(edge.type, []);
+      this._edgesByType.get(edge.type).push(edge);
+    }
+  }
+
+  /**
+   * Find nodes by type.
+   * @param {string} type
+   * @returns {MPCGNode[]}
+   */
+  findByType(type) {
+    return this._byType.get(type) || [];
+  }
+
+  /**
+   * Get a node by ID.
+   * @param {string} id
+   * @returns {MPCGNode | undefined}
+   */
+  getNode(id) {
+    return this.nodes.get(id);
+  }
+
+  /**
+   * Get outgoing edges from a node, optionally filtered by edge type.
+   * @param {string} nodeId
+   * @param {string} [edgeType]
+   * @returns {MPCGEdge[]}
+   */
+  outgoing(nodeId, edgeType) {
+    const edges = this._outgoing.get(nodeId) || [];
+    return edgeType ? edges.filter(e => e.type === edgeType) : edges;
+  }
+
+  /**
+   * Get incoming edges to a node, optionally filtered by edge type.
+   * @param {string} nodeId
+   * @param {string} [edgeType]
+   * @returns {MPCGEdge[]}
+   */
+  incoming(nodeId, edgeType) {
+    const edges = this._incoming.get(nodeId) || [];
+    return edgeType ? edges.filter(e => e.type === edgeType) : edges;
+  }
+
+  /**
+   * Find all edges of a given type.
+   * @param {string} type
+   * @returns {MPCGEdge[]}
+   */
+  edgesOfType(type) {
+    return this._edgesByType.get(type) || [];
+  }
+
+  /**
+   * Follow a causal chain from a node (BFS).
+   * @param {string} startId
+   * @param {number} [maxDepth=10]
+   * @returns {CausalChainEntry[]}
+   */
+  causalChain(startId, maxDepth = 10) {
+    const causalEdges = new Set(["causes", "enables", "transforms", "disrupts",
+      "amplifies", "cascades_to", "overwhelms"]);
+    const visited = new Set();
+    const chain = [];
+    let frontier = [{ id: startId, depth: 0 }];
+
+    while (frontier.length > 0) {
+      const { id, depth } = frontier.shift();
+      if (visited.has(id) || depth > maxDepth) continue;
+      visited.add(id);
+
+      const node = this.getNode(id);
+      if (node) chain.push({ node, depth });
+
+      for (const edge of this.outgoing(id)) {
+        if (causalEdges.has(edge.type)) {
+          frontier.push({ id: edge.target, depth: depth + 1 });
+        }
+      }
+    }
+    return chain;
+  }
+
+  /**
+   * Find all beliefs held by an agent.
+   * @param {string} agentId
+   * @returns {MPCGNode[]}
+   */
+  beliefsOf(agentId) {
+    return this.outgoing(agentId, "believes")
+      .map(e => this.getNode(e.target))
+      .filter(Boolean);
+  }
+
+  /**
+   * Find contradictions -- pairs of nodes connected by 'contradicts'.
+   * @returns {Contradiction[]}
+   */
+  contradictions() {
+    return this.edgesOfType("contradicts").map(e => ({
+      a: this.getNode(e.source),
+      b: this.getNode(e.target),
+      edge: e
+    }));
+  }
+
+  /**
+   * Find all provenance for a node.
+   * @param {string} nodeId
+   * @returns {ProvenanceResult}
+   */
+  provenance(nodeId) {
+    const sources = this.incoming(nodeId, "sourced_from").map(e => this.getNode(e.source));
+    const evidence = this.incoming(nodeId, "evidenced_by").map(e => this.getNode(e.source));
+    const assertors = this.incoming(nodeId, "asserted_by").map(e => this.getNode(e.source));
+    return { sources, evidence, assertors };
+  }
+
+  /**
+   * Filter graph by security clearance.
+   * @param {string} classification
+   * @param {string} [releasableTo]
+   * @returns {FilteredGraph}
+   */
+  visibleAt(classification, releasableTo) {
+    const classOrder = ["UGRADERT", "BEGRENSET", "KONFIDENSIELT", "HEMMELIG", "STRENGT HEMMELIG"];
+    const maxLevel = classOrder.indexOf(classification);
+
+    return {
+      nodes: [...this.nodes.values()].filter(n => {
+        if (!n.security?.classification) return true; // unclassified = visible
+        const nodeLevel = classOrder.indexOf(n.security.classification);
+        if (nodeLevel < 0) return true; // unknown classification = visible (permissive)
+        return nodeLevel <= maxLevel;
+      }),
+      edges: this.edges.filter(e => {
+        if (!e.security?.classification) return true;
+        const edgeLevel = classOrder.indexOf(e.security.classification);
+        return edgeLevel <= maxLevel;
+      })
+    };
+  }
+
+  /**
+   * Get graph statistics.
+   * @returns {GraphStats}
+   */
+  stats() {
+    return {
+      nodes: this.nodes.size,
+      edges: this.edges.length,
+      nodeTypes: [...this._byType.keys()],
+      edgeTypes: [...this._edgesByType.keys()],
+      perspective: this.perspective,
+      security: this.security?.classification
+    };
+  }
+}
diff --git a/packages/core/index.js b/packages/core/index.js
index 00d4e46..b247b80 100644
--- a/packages/core/index.js
+++ b/packages/core/index.js
@@ -4,10 +4,16 @@ import { fileURLToPath } from 'url';
 
 const __dirname = dirname(fileURLToPath(import.meta.url));
 
+/** @type {object} */
 const schema = JSON.parse(readFileSync(join(__dirname, 'schema.json'), 'utf-8'));
+
+/** @type {object} */
 const taxonomy = JSON.parse(readFileSync(join(__dirname, 'taxonomy.json'), 'utf-8'));
 
+/** @type {string[]} */
 const nodeTypes = schema.$defs.NodeType.enum;
+
+/** @type {string[]} */
 const edgeTypes = schema.$defs.EdgeType.enum;
 
 export { validate } from './validate.js';
diff --git a/packages/core/tests/jsdoc-check.test.js b/packages/core/tests/jsdoc-check.test.js
new file mode 100644
index 0000000..6f394b8
--- /dev/null
+++ b/packages/core/tests/jsdoc-check.test.js
@@ -0,0 +1,125 @@
+import { describe, it } from 'node:test';
+import { execSync } from 'node:child_process';
+import { readFileSync } from 'node:fs';
+import assert from 'node:assert';
+import { join, dirname } from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const __dirname = dirname(fileURLToPath(import.meta.url));
+const coreDir = join(__dirname, '..');
+
+function runTscProject() {
+  // Safe: uses hardcoded tsconfig path, no user input
+  execSync(
+    'npx tsc --project tsconfig.jsdoc-check.json',
+    { cwd: coreDir, stdio: 'pipe' }
+  );
+}
+
+describe('JSDoc annotations', () => {
+  it('tsc --noEmit runs against all core files without type errors', () => {
+    runTscProject();
+  });
+
+  it('all @typedef types are referenced by at least one @param or @returns', () => {
+    for (const filename of ['validate.js', 'graph-engine.js']) {
+      const content = readFileSync(join(coreDir, filename), 'utf-8');
+
+      // Extract all @typedef names (handles both inline and multi-line forms)
+      const typedefNames = [];
+      const inlinePattern = /@typedef\s+\{[^}]+\}\s+(\w+)/g;
+      let match;
+      while ((match = inlinePattern.exec(content)) !== null) {
+        typedefNames.push(match[1]);
+      }
+
+      // Check each typedef name appears in @param, @returns, or another @typedef import
+      for (const name of typedefNames) {
+        const usagePattern = new RegExp(
+          `@(?:param|returns|type)\\s+\\{[^}]*${name}[^}]*\\}`,
+        );
+        const importPattern = new RegExp(
+          `@typedef\\s+\\{import\\([^)]+\\)\\.${name}\\}\\s+${name}`,
+        );
+        assert.ok(
+          usagePattern.test(content) || importPattern.test(content),
+          `@typedef ${name} in ${filename} is never referenced by @param, @returns, or @type`
+        );
+      }
+    }
+  });
+
+  it('MPCGGraph class has JSDoc on constructor and all 11 public methods', () => {
+    const content = readFileSync(join(coreDir, 'graph-engine.js'), 'utf-8');
+
+    const expectedMethods = [
+      'constructor', 'findByType', 'getNode', 'outgoing', 'incoming',
+      'edgesOfType', 'causalChain', 'beliefsOf', 'contradictions',
+      'provenance', 'visibleAt', 'stats'
+    ];
+
+    for (const method of expectedMethods) {
+      // Match JSDoc comment block followed by the method definition
+      const pattern = method === 'constructor'
+        ? /\/\*\*[\s\S]*?\*\/\s*constructor\s*\(/
+        : new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*${method}\\s*\\(`);
+      assert.ok(
+        pattern.test(content),
+        `Method ${method} is missing a JSDoc comment block`
+      );
+    }
+  });
+
+  it('validate function has JSDoc with correct parameter and return types', () => {
+    const content = readFileSync(join(coreDir, 'validate.js'), 'utf-8');
+
+    assert.ok(
+      /@param\s+\{MPCGGraphInput\}\s+graph/.test(content),
+      'validate() missing @param {MPCGGraphInput} graph'
+    );
+    assert.ok(
+      /@param\s+\{ValidateOptions\}\s+\[options\]/.test(content),
+      'validate() missing @param {ValidateOptions} [options]'
+    );
+    assert.ok(
+      /@returns\s+\{ValidationResult\}/.test(content),
+      'validate() missing @returns {ValidationResult}'
+    );
+  });
+
+  it('ValidationResult and ValidationStats are distinct types', () => {
+    const content = readFileSync(join(coreDir, 'validate.js'), 'utf-8');
+
+    // ValidationStats must have nodeTypes: number (a count)
+    assert.ok(
+      /ValidationStats/.test(content) && /nodeTypes:\s*number/.test(content),
+      'ValidationStats should have nodeTypes as number'
+    );
+
+    // ValidationResult must reference ValidationStats via stats property (optional since early return may omit it)
+    assert.ok(
+      /stats\??:\s*ValidationStats/.test(content),
+      'ValidationResult should have stats: ValidationStats'
+    );
+  });
+
+  it('GraphStats type has nodeTypes as string[] (not number)', () => {
+    const content = readFileSync(join(coreDir, 'graph-engine.js'), 'utf-8');
+
+    // Find the line containing GraphStats typedef
+    const graphStatsLine = content.split('\n').find(l => l.includes('GraphStats') && l.includes('@typedef'));
+    assert.ok(graphStatsLine, 'GraphStats @typedef not found');
+
+    // Verify nodeTypes is string[] (not number)
+    assert.ok(
+      /nodeTypes:\s*string\[\]/.test(graphStatsLine),
+      'GraphStats should have nodeTypes as string[]'
+    );
+
+    // Verify edgeTypes is string[]
+    assert.ok(
+      /edgeTypes:\s*string\[\]/.test(graphStatsLine),
+      'GraphStats should have edgeTypes as string[]'
+    );
+  });
+});
diff --git a/packages/core/tsconfig.jsdoc-check.json b/packages/core/tsconfig.jsdoc-check.json
new file mode 100644
index 0000000..5921dab
--- /dev/null
+++ b/packages/core/tsconfig.jsdoc-check.json
@@ -0,0 +1,13 @@
+{
+  "compilerOptions": {
+    "noEmit": true,
+    "allowJs": true,
+    "checkJs": true,
+    "moduleResolution": "node16",
+    "module": "node16",
+    "target": "es2022",
+    "strict": false,
+    "skipLibCheck": true
+  },
+  "include": ["validate.js", "graph-engine.js", "index.js"]
+}
diff --git a/packages/core/validate.js b/packages/core/validate.js
index 22267a4..db72f30 100644
--- a/packages/core/validate.js
+++ b/packages/core/validate.js
@@ -9,6 +9,30 @@
  * The CLI block from src/validate.js is removed — this is a library module.
  */
 
+/**
+ * @typedef {{ id: string, type: string, label: string, properties?: Object, security?: Object, perspective?: Object, encoding_completeness?: string }} MPCGNode
+ */
+
+/**
+ * @typedef {{ source: string, target: string, type: string, properties?: Object, weight?: number, confidence?: number, security?: Object }} MPCGEdge
+ */
+
+/**
+ * @typedef {{ id: string, nodes: MPCGNode[], edges: MPCGEdge[], perspective?: Object, security?: Object, operational_mode?: string }} MPCGGraphInput
+ */
+
+/**
+ * @typedef {{ schema?: object, taxonomy?: object }} ValidateOptions
+ */
+
+/**
+ * @typedef {{ nodes: number, edges: number, nodeTypes: number, edgeTypes: number, errors: number, warnings: number }} ValidationStats
+ */
+
+/**
+ * @typedef {{ valid: boolean, errors: string[], warnings: string[], stats?: ValidationStats }} ValidationResult
+ */
+
 import Ajv2020 from "ajv/dist/2020.js";
 import addFormats from "ajv-formats";
 import { readFileSync } from "fs";
@@ -32,7 +56,9 @@ function buildAncestry(tree, parentChain = []) {
 
 // Build a complete validation state from schema + taxonomy
 function buildState(schema, taxonomy) {
+  // @ts-ignore -- ajv CJS default export not recognized under ESM checkJs
   const ajv = new Ajv2020({ allErrors: true, strict: false });
+  // @ts-ignore -- ajv-formats CJS default export not recognized under ESM checkJs
   addFormats(ajv);
   const validateSchema = ajv.compile(schema);
   const nodeAncestry = buildAncestry(taxonomy.nodeTypes);
@@ -81,6 +107,12 @@ function resolveState(options) {
   return cachedCustomState;
 }
 
+/**
+ * Validates an MPCG context graph against schema, taxonomy, and formal constraints.
+ * @param {MPCGGraphInput} graph
+ * @param {ValidateOptions} [options]
+ * @returns {ValidationResult}
+ */
 function validate(graph, options = {}) {
   const state = resolveState(options);
   const errors = [];
