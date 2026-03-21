# Prompt Contract: claude-spec.md

## GOAL
Synthesize the initial spec, codebase research, web research, and interview answers into a complete specification for the @mpcg/core npm package. Must capture all requirements, constraints, and decisions without adding implementation architecture choices.

## CONSTRAINTS
- Must incorporate all three input sources: spec.md, claude-research.md, claude-interview.md
- Must reflect user decisions from interview (pnpm workspaces, JSDoc + generate types, parameterize validate.js, Node 20+, local workspace consumption)
- Must describe WHAT the package delivers, not HOW to build it

## FAILURE CONDITIONS
- SHALL NOT omit requirements from any input source
- SHALL NOT include architecture or implementation choices (build steps, file organization details)
- SHALL NOT contradict interview decisions
- SHALL NOT add features beyond what was specified or discussed
