# Section 03: Layout and Context — Prompt Contract

## GOAL
Implement the OntologyBrowser layout component with resizable panels and the OntologyBrowserContext that provides shared state (selected class ID, label mode) across the browser. Connect the context to the data layer for stale selection recovery.

## CONTEXT
Section 03 bridges the route infrastructure (section 01) and data layer (section 02) with the UI layout that sections 04-09 will build upon. The resizable split-panel layout and shared context are foundational — every subsequent section depends on them.

## CONSTRAINTS
- Use existing Shadcn resizable wrappers from `@/components/ui/resizable`
- Use existing `useClassTree` hook from section 02 for class list data
- Follow TDD: write tests first, then implementation
- React default JSX escaping only — no raw HTML rendering (V-222602)
- Handle malformed localStorage values gracefully without crashing (V-222609)
- Error boundaries must isolate panel failures independently

## FORMAT — Files to create/modify
- `frontend/src/features/ontology/components/OntologyBrowserContext.tsx` (modify existing scaffold)
- `frontend/src/features/ontology/components/OntologyBrowser.tsx` (modify existing scaffold)
- `frontend/src/features/ontology/components/OntologyBrowserContext.test.tsx` (new)
- `frontend/src/features/ontology/components/OntologyBrowser.test.tsx` (new)
- `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` (update stub)
- `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx` (update stub)
- `frontend/src/routes/admin/ontology/browser.tsx` (wire OntologyBrowser component)

## FAILURE CONDITIONS
- SHALL NOT skip any of the 11 specified test cases
- SHALL NOT use raw HTML rendering or bypass React escaping
- SHALL NOT crash on malformed localStorage values
- SHALL NOT allow error in one panel to crash the other panel
- SHALL NOT violate STIG controls V-222602, V-222609
