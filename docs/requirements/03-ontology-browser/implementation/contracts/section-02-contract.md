# Prompt Contract: Section 02 - Data Layer

## GOAL
Implement buildClassTree pure function, useClassTree hook (fetch + filter), and useClassDetail hook (fetch + mutations).

## CONSTRAINTS
- Reuse existing API functions from @/features/ontology/lib/api
- TDD: write tests first, then implementation
- source_id handled via graceful degradation (optional field)

## FORMAT
- Created: buildClassTree.ts, buildClassTree.test.ts
- Modified: useClassTree.ts (replace placeholder)
- Created: useClassTree.test.ts (tsx for JSX in wrapper)
- Modified: useClassDetail.ts (replace placeholder)
- Created: useClassDetail.test.ts (tsx for JSX in wrapper)

## FAILURE CONDITIONS
- SHALL NOT skip tests
- SHALL NOT create new API endpoints or functions
- SHALL NOT use any as type escape without documenting the reason
