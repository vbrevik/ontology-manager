# Plan Contract

## GOAL
Produce a self-contained implementation blueprint for promoting the ontology browser from `/admin/ontology/browser` to `/ontology` as a top-level route, with primary navigation placement and a tabbed detail panel.

## CONTEXT
The ontology browser is the core user-facing tool but is currently buried under admin. This plan drives the restructuring work — all section files and implementation will be derived from it.

## CONSTRAINTS
- Plans are prose documents, zero full function implementations
- Must follow plan-writing.md guidelines (type definitions and signatures only)
- Must follow existing TanStack Router file-based routing conventions
- Must follow existing MainSidebar navigation patterns
- Must use existing shadcn Tabs component

## FORMAT
Single file `claude-plan.md` with sections that map to implementable units.

## FAILURE CONDITIONS
- SHALL NOT contain full function bodies
- SHALL NOT assume reader has prior context
- SHALL NOT omit testing strategy
- SHALL NOT add features beyond the spec
- SHALL NOT modify admin governance routes
