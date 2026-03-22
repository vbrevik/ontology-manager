# Section 06: Shared Components — Prompt Contract

## GOAL
Implement three shared UI components (SourceBadge, ConflictBadge, ClassLink) with full test coverage. These replace existing stubs created in section-05.

## CONTEXT
These components are consumed by ClassTree (section-04) and ClassDetail (section-05). They must remain decoupled from OntologyBrowserContext — accepting callbacks as props instead.

## CONSTRAINTS
- Use existing Shadcn Badge and Tooltip components
- Components accept callback props, no direct context imports
- TDD: tests first, then implementation
- Test stack: Vitest + @testing-library/react + @testing-library/jest-dom

## FORMAT (files to modify)
- `frontend/src/features/ontology/components/shared/SourceBadge.tsx` (rewrite)
- `frontend/src/features/ontology/components/shared/SourceBadge.test.tsx` (create)
- `frontend/src/features/ontology/components/shared/ConflictBadge.tsx` (rewrite)
- `frontend/src/features/ontology/components/shared/ConflictBadge.test.tsx` (create)
- `frontend/src/features/ontology/components/shared/ClassLink.tsx` (rewrite)
- `frontend/src/features/ontology/components/shared/ClassLink.test.tsx` (create)

## FAILURE CONDITIONS
- SHALL NOT import OntologyBrowserContext directly in shared components
- SHALL NOT skip tests for any component
- SHALL NOT break existing tests in ClassHeader, ClassDetail, ClassProperties
- SHALL NOT use `<a>` tag for ClassLink (must be `<button>`)
- SHALL NOT produce non-deterministic colors in SourceBadge
