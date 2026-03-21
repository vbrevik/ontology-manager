diff --git a/packages/core/package.json b/packages/core/package.json
index 02c89f6..23de9e0 100644
--- a/packages/core/package.json
+++ b/packages/core/package.json
@@ -3,6 +3,7 @@
   "version": "1.0.0",
   "description": "MPCG (Multi-Perspective Context Graph) core library — schema, validation, and graph engine",
   "type": "module",
+  "types": "./types/index.d.ts",
   "private": true,
   "engines": {
     "node": ">=20"
diff --git a/packages/core/tests/typescript-pipeline.test.js b/packages/core/tests/typescript-pipeline.test.js
new file mode 100644
index 0000000..a0b151b
--- /dev/null
+++ b/packages/core/tests/typescript-pipeline.test.js
@@ -0,0 +1,85 @@
+import { describe, it, before } from 'node:test';
+import { execSync } from 'node:child_process';
+import { readFileSync, existsSync } from 'node:fs';
+import assert from 'node:assert';
+import { join, dirname } from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const __dirname = dirname(fileURLToPath(import.meta.url));
+const coreDir = join(__dirname, '..');
+
+describe('TypeScript generation pipeline', () => {
+  it('tsconfig.json exists in packages/core/', () => {
+    assert.ok(
+      existsSync(join(coreDir, 'tsconfig.json')),
+      'tsconfig.json should exist in packages/core/'
+    );
+  });
+
+  it('tsconfig.json has moduleResolution set to "node16"', () => {
+    const config = JSON.parse(readFileSync(join(coreDir, 'tsconfig.json'), 'utf-8'));
+    assert.strictEqual(
+      config.compilerOptions.moduleResolution.toLowerCase(),
+      'node16',
+      'moduleResolution should be node16'
+    );
+  });
+
+  describe('tsc output', () => {
+    before(() => {
+      // Safe: hardcoded tsc invocation with no user input
+      execSync('npx tsc --project tsconfig.json', { cwd: coreDir, stdio: 'pipe' });
+    });
+
+    it('generates types/index.d.ts', () => {
+      assert.ok(existsSync(join(coreDir, 'types', 'index.d.ts')));
+    });
+
+    it('generates types/validate.d.ts', () => {
+      assert.ok(existsSync(join(coreDir, 'types', 'validate.d.ts')));
+    });
+
+    it('generates types/graph-engine.d.ts', () => {
+      assert.ok(existsSync(join(coreDir, 'types', 'graph-engine.d.ts')));
+    });
+
+    it('index.d.ts exports validate, MPCGGraph, schema, taxonomy, nodeTypes, edgeTypes', () => {
+      const content = readFileSync(join(coreDir, 'types', 'index.d.ts'), 'utf-8');
+      for (const symbol of ['validate', 'MPCGGraph', 'schema', 'taxonomy', 'nodeTypes', 'edgeTypes']) {
+        assert.ok(
+          content.includes(symbol),
+          `index.d.ts should export ${symbol}`
+        );
+      }
+    });
+
+    it('generated types include MPCGNode, MPCGEdge, ValidationResult', () => {
+      const validateDts = readFileSync(join(coreDir, 'types', 'validate.d.ts'), 'utf-8');
+      for (const typeName of ['MPCGNode', 'MPCGEdge', 'ValidationResult']) {
+        assert.ok(
+          validateDts.includes(typeName),
+          `validate.d.ts should contain ${typeName}`
+        );
+      }
+    });
+
+    it('package.json exports field has "types" before "default"', () => {
+      const pkg = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf-8'));
+      const keys = Object.keys(pkg.exports['.']);
+      const typesIdx = keys.indexOf('types');
+      const defaultIdx = keys.indexOf('default');
+      assert.ok(typesIdx >= 0, 'exports should have "types" key');
+      assert.ok(defaultIdx >= 0, 'exports should have "default" key');
+      assert.ok(typesIdx < defaultIdx, '"types" should appear before "default"');
+    });
+
+    it('declarationMap files (.d.ts.map) are generated', () => {
+      for (const name of ['index', 'validate', 'graph-engine']) {
+        assert.ok(
+          existsSync(join(coreDir, 'types', `${name}.d.ts.map`)),
+          `${name}.d.ts.map should exist`
+        );
+      }
+    });
+  });
+});
diff --git a/packages/core/tsconfig.json b/packages/core/tsconfig.json
new file mode 100644
index 0000000..79d7836
--- /dev/null
+++ b/packages/core/tsconfig.json
@@ -0,0 +1,16 @@
+{
+  "compilerOptions": {
+    "allowJs": true,
+    "checkJs": true,
+    "declaration": true,
+    "emitDeclarationOnly": true,
+    "declarationDir": "./types",
+    "declarationMap": true,
+    "strict": false,
+    "module": "node16",
+    "moduleResolution": "node16",
+    "target": "ES2020",
+    "skipLibCheck": true
+  },
+  "include": ["index.js", "validate.js", "graph-engine.js"]
+}
