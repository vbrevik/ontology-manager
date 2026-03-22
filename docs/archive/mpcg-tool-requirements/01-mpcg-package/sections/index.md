<!-- PROJECT_CONFIG
runtime: typescript-pnpm
test_command: pnpm test
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-workspace-foundation
section-02-package-structure
section-03-validate-parameterization
section-04-jsdoc-annotations
section-05-typescript-pipeline
section-06-build-scripts
section-07-package-tests
section-08-integration-verification
END_MANIFEST -->

# Implementation Sections Index

## Dependency Graph

| Section | Depends On | Blocks | Parallelizable |
|---------|------------|--------|----------------|
| section-01-workspace-foundation | - | all | Yes |
| section-02-package-structure | 01 | 03, 04, 05, 06 | No |
| section-03-validate-parameterization | 02 | 04, 07 | Yes |
| section-04-jsdoc-annotations | 02, 03 | 05 | No |
| section-05-typescript-pipeline | 04 | 07 | No |
| section-06-build-scripts | 02 | 07, 08 | Yes |
| section-07-package-tests | 03, 05, 06 | 08 | No |
| section-08-integration-verification | 07 | - | No |

## Execution Order

1. section-01-workspace-foundation (no dependencies)
2. section-02-package-structure (after 01)
3. section-03-validate-parameterization, section-06-build-scripts (parallel after 02)
4. section-04-jsdoc-annotations (after 03)
5. section-05-typescript-pipeline (after 04)
6. section-07-package-tests (after 05, 06)
7. section-08-integration-verification (final)

## Section Summaries

### section-01-workspace-foundation
Create pnpm-workspace.yaml, update root package.json with "private": true, create packages/core/package.json with correct configuration. Set up .gitignore entries for build artifacts.

### section-02-package-structure
Create packages/core/index.js entry point that re-exports all public API. Load schema.json and taxonomy.json via readFileSync, extract nodeTypes and edgeTypes arrays.

### section-03-validate-parameterization
Modify validate.js for packages/core/: add optional { schema, taxonomy } parameter, guard CLI side-effects, rebuild derived state (ancestry maps, type sets, AJV instance) when custom options provided, cache for performance.

### section-04-jsdoc-annotations
Add JSDoc @typedef and @param/@returns annotations to validate.js and graph-engine.js in packages/core/. Define MPCGNode, MPCGEdge, ValidationResult, ValidationStats, GraphStats, and all other public types.

### section-05-typescript-pipeline
Create tsconfig.json with moduleResolution: node16, configure tsc to generate .d.ts files into types/ directory. Verify generated declarations export all public types.

### section-06-build-scripts
Create scripts/build.js that copies schema.json, taxonomy.json, graph-engine.js from src/ to packages/core/. Add clean, build, prebuild scripts to package.json.

### section-07-package-tests
Create packages/core/tests/package-import.test.js testing all exports via @mpcg/core import. Create types.test.ts and tsconfig.test.json for TypeScript compilation verification.

### section-08-integration-verification
End-to-end verification: pnpm install, existing tests pass, package build, package tests, type compilation. Document any edge cases encountered.
