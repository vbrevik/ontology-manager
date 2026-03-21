# Prompt Contract: claude-plan.md

## GOAL
Deliver a self-contained prose blueprint for implementing the @mpcg/core npm package. The plan must cover what to build, why each decision was made, and how to implement it — without containing full function bodies. An unfamiliar engineer or LLM should be able to implement the entire package from this plan alone.

## CONTEXT
This plan drives all downstream section files and implementation via deep-implement. The @mpcg/core package wraps four existing source files (schema.json, taxonomy.json, validate.js, graph-engine.js) into a pnpm workspace package with JSDoc-generated TypeScript types, parameterized validation, and workspace-linked consumption by sibling packages.

## CONSTRAINTS
- Plans are prose documents with minimal code (type definitions, signatures, directory trees only)
- ZERO full function implementations — deep-implement handles code
- Must follow plan-writing.md guidelines
- Must incorporate all inputs: claude-spec.md, claude-research.md, claude-interview.md
- Must address: pnpm workspace setup, validate.js parameterization, JSDoc annotation strategy, build script for file copying, TypeScript generation pipeline, test strategy
- Sections must map to implementable units suitable for section splitting

## FORMAT
Single file `claude-plan.md` with sections that each represent a distinct implementable unit:
1. Workspace foundation (pnpm setup, root config)
2. Package structure and entry point
3. Source file modifications (validate.js parameterization)
4. JSDoc annotations for type generation
5. TypeScript generation pipeline
6. Build and copy scripts
7. Package tests
8. Integration verification

## FAILURE CONDITIONS
- SHALL NOT contain full function bodies
- SHALL NOT assume reader has prior context
- SHALL NOT omit testing strategy
- SHALL NOT add features beyond the spec
- SHALL NOT contradict interview decisions (pnpm, JSDoc generation, parameterized validate, Node 20+, local workspace only)
