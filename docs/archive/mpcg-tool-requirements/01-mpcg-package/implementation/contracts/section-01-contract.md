# Prompt Contract: Section 01 — Workspace Foundation

## GOAL
Convert the UCM project to a pnpm workspace monorepo with @mpcg/core package skeleton.

## CONSTRAINTS
- Root package.json must retain all existing dependencies and scripts
- Only add "private": true to root package.json
- packages/core/package.json has correct exports, engines, dependencies
- .gitignore excludes build artifacts but not committed source files

## FORMAT
Files: pnpm-workspace.yaml, package.json (modify), packages/core/package.json, packages/core/.gitignore, packages/core/tests/workspace-setup.test.js

## FAILURE CONDITIONS
- SHALL NOT remove existing dependencies or scripts from root package.json
- SHALL NOT modify any files in src/
- SHALL NOT create source files (index.js, validate.js) — those are later sections
