# Interview Transcript — @mpcg/core Package

## Q1: Path Resolution Strategy for validate.js

**Question:** The validate.js file loads schema.json and taxonomy.json via readFileSync with __dirname. When packaged, these paths break. Should we modify validate.js to accept schema/taxonomy as parameters, keep the current API and use a build script, or both?

**Answer:** Both — parameterize + copy. Make schema/taxonomy injectable as optional parameters but also include copies in the package for zero-config default usage.

## Q2: Workspace Setup

**Question:** Should this be a full npm workspace setup now (anticipating 02-mpcg-api and 03-mpcg-web), or a standalone package directory?

**Answer:** Full workspace now. Set up workspaces in root package.json, ready for all three packages.

## Q3: TypeScript Types Approach

**Question:** Hand-write .d.ts files or add JSDoc to source files and generate types?

**Answer:** Add JSDoc + generate. Annotate source JS with JSDoc, use tsc to generate .d.ts — keeps types in sync with source.

## Q4: Package Manager

**Question:** npm workspaces or pnpm workspaces?

**Answer:** pnpm workspaces. Stricter dependency isolation, workspace: protocol for local refs.

## Q5: Graph Engine Dependencies

**Question:** Should MPCGGraph's constructor become parameterizable with a custom validator, or keep internal imports?

**Answer:** Internal import only. graph-engine.js imports its co-located validate.js — keep it simple.

## Q6: Publishing Strategy

**Question:** Publish to npm or local workspace only?

**Answer:** Local workspace only. Consumed by sibling packages via workspace linking.

## Q7: Test Location

**Question:** Move tests into packages/core/ or keep in src/tests/?

**Answer:** Keep tests in src/tests/. Existing tests stay with relative imports, add new package-import tests in packages/core/.

## Q8: Node.js Version

**Question:** Node.js version constraint?

**Answer:** Node 20+. Declare in engines field.
