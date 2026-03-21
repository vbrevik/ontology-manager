diff --git a/.gitignore b/.gitignore
index e8c3d25..3be6089 100644
--- a/.gitignore
+++ b/.gitignore
@@ -1,3 +1,10 @@
 node_modules/
 output/
 .env
+
+# @mpcg/core build artifacts — copied from src/ by scripts/build.js
+packages/core/schema.json
+packages/core/taxonomy.json
+
+# @mpcg/core generated TypeScript declarations
+packages/core/types/
diff --git a/packages/core/package.json b/packages/core/package.json
index 23de9e0..eb7d8ef 100644
--- a/packages/core/package.json
+++ b/packages/core/package.json
@@ -23,7 +23,7 @@
     "types/"
   ],
   "scripts": {
-    "clean": "rm -rf types/ schema.json taxonomy.json graph-engine.js",
+    "clean": "rm -rf types/ schema.json taxonomy.json",
     "prebuild": "pnpm run clean",
     "build": "node scripts/build.js && tsc",
     "test": "node --test tests/*.test.js",
diff --git a/packages/core/scripts/build.js b/packages/core/scripts/build.js
new file mode 100644
index 0000000..aa69034
--- /dev/null
+++ b/packages/core/scripts/build.js
@@ -0,0 +1,27 @@
+/**
+ * Build script for @mpcg/core
+ *
+ * Copies shared source files from src/ into the package directory.
+ * validate.js is NOT copied — it is maintained separately in packages/core/
+ * with parameterization changes (see Section 3).
+ */
+
+import { copyFileSync } from 'node:fs';
+import { join, resolve, dirname } from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const __dirname = dirname(fileURLToPath(import.meta.url));
+const pkgDir = resolve(__dirname, '..');
+const srcDir = resolve(__dirname, '..', '..', '..', 'src');
+
+// graph-engine.js is NOT copied — it is maintained separately in packages/core/
+// with JSDoc annotations (see Section 4). Only data files are copied.
+const FILES_TO_COPY = [
+  'schema.json',
+  'taxonomy.json',
+];
+
+for (const file of FILES_TO_COPY) {
+  copyFileSync(join(srcDir, file), join(pkgDir, file));
+  console.log(`Copied ${file}`);
+}
diff --git a/packages/core/tests/build.test.js b/packages/core/tests/build.test.js
new file mode 100644
index 0000000..ff5cd5c
--- /dev/null
+++ b/packages/core/tests/build.test.js
@@ -0,0 +1,91 @@
+import { describe, it, before } from 'node:test';
+import assert from 'node:assert/strict';
+import { execSync } from 'node:child_process';
+import { readFileSync, existsSync } from 'node:fs';
+import { join, resolve, dirname } from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+const __dirname = dirname(fileURLToPath(import.meta.url));
+const ROOT = resolve(__dirname, '..', '..', '..');
+const PKG = resolve(ROOT, 'packages', 'core');
+const SRC = resolve(ROOT, 'src');
+
+describe('build script', () => {
+  it('scripts/build.js exists in packages/core/', () => {
+    assert.ok(existsSync(join(PKG, 'scripts', 'build.js')));
+  });
+
+  describe('after running build script', () => {
+    before(() => {
+      // Safe: hardcoded script path, no user input
+      execSync('node scripts/build.js', { cwd: PKG, stdio: 'pipe' });
+    });
+
+    it('copies schema.json from src/ to packages/core/', () => {
+      assert.ok(existsSync(join(PKG, 'schema.json')));
+    });
+
+    it('copies taxonomy.json from src/ to packages/core/', () => {
+      assert.ok(existsSync(join(PKG, 'taxonomy.json')));
+    });
+
+    it('does NOT overwrite validate.js', () => {
+      const content = readFileSync(join(PKG, 'validate.js'), 'utf-8');
+      assert.ok(
+        content.includes('ValidateOptions'),
+        'validate.js should still contain parameterized ValidateOptions typedef'
+      );
+    });
+
+    it('copied schema.json is byte-identical to src/schema.json', () => {
+      const src = readFileSync(join(SRC, 'schema.json'));
+      const dst = readFileSync(join(PKG, 'schema.json'));
+      assert.deepStrictEqual(src, dst);
+    });
+
+    it('copied taxonomy.json is byte-identical to src/taxonomy.json', () => {
+      const src = readFileSync(join(SRC, 'taxonomy.json'));
+      const dst = readFileSync(join(PKG, 'taxonomy.json'));
+      assert.deepStrictEqual(src, dst);
+    });
+
+    it('does NOT overwrite graph-engine.js (maintained separately with JSDoc)', () => {
+      const content = readFileSync(join(PKG, 'graph-engine.js'), 'utf-8');
+      assert.ok(
+        content.includes('GraphStats'),
+        'graph-engine.js should still contain JSDoc GraphStats typedef'
+      );
+    });
+  });
+});
+
+describe('clean script', () => {
+  it('clean removes build artifacts from packages/core/', () => {
+    // Safe: hardcoded commands, no user input
+    execSync('node scripts/build.js', { cwd: PKG, stdio: 'pipe' });
+    execSync('pnpm run clean', { cwd: PKG, stdio: 'pipe' });
+    assert.ok(!existsSync(join(PKG, 'types')), 'types/ should be removed');
+    assert.ok(!existsSync(join(PKG, 'schema.json')), 'schema.json should be removed');
+    assert.ok(!existsSync(join(PKG, 'taxonomy.json')), 'taxonomy.json should be removed');
+    assert.ok(existsSync(join(PKG, 'validate.js')), 'validate.js should NOT be removed');
+    assert.ok(existsSync(join(PKG, 'index.js')), 'index.js should NOT be removed');
+  });
+});
+
+describe('.gitignore', () => {
+  it('.gitignore includes packages/core build artifacts', () => {
+    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf-8');
+    for (const entry of ['packages/core/schema.json', 'packages/core/taxonomy.json', 'packages/core/types/']) {
+      assert.ok(gitignore.includes(entry), `.gitignore should include ${entry}`);
+    }
+  });
+});
+
+describe('full build pipeline', () => {
+  it('clean -> copy -> tsc completes without errors', () => {
+    // Safe: hardcoded pnpm build command
+    execSync('pnpm run build', { cwd: PKG, stdio: 'pipe' });
+    assert.ok(existsSync(join(PKG, 'types', 'index.d.ts')), 'types/index.d.ts should exist after full build');
+    assert.ok(existsSync(join(PKG, 'schema.json')), 'schema.json should exist after full build');
+  });
+});
diff --git a/packages/core/tests/typescript-pipeline.test.js b/packages/core/tests/typescript-pipeline.test.js
index a0b151b..ae3105a 100644
--- a/packages/core/tests/typescript-pipeline.test.js
+++ b/packages/core/tests/typescript-pipeline.test.js
@@ -27,7 +27,9 @@ describe('TypeScript generation pipeline', () => {
 
   describe('tsc output', () => {
     before(() => {
-      // Safe: hardcoded tsc invocation with no user input
+      // Ensure build artifacts exist (may have been cleaned by other tests)
+      // Safe: hardcoded commands, no user input
+      execSync('node scripts/build.js', { cwd: coreDir, stdio: 'pipe' });
       execSync('npx tsc --project tsconfig.json', { cwd: coreDir, stdio: 'pipe' });
     });
 
