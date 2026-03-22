# Section 05: Detail Panel — Prompt Contract

## GOAL
Implement the right-side detail panel showing class header, properties list, and conflict information when a class is selected in the tree.

## CONTEXT
Section 05 builds the right panel content. It reads selectedClassId from context (section 03), fetches data via useClassDetail (section 02), and displays it through ClassHeader, ClassProperties, and ClassConflicts sub-components.

## CONSTRAINTS
- Use existing useClassDetail hook from section 02 for data fetching
- Section-06 shared components (SourceBadge, ConflictBadge, ClassLink) are stubs — mock in tests
- Mutation wiring deferred to section 07 (inline editing) — accept callback props
- React default JSX escaping only (V-222602)
- Handle loading/empty/error states gracefully (V-222609)

## FORMAT — Files to create/modify
- `ClassDetail.tsx` + `ClassDetail.test.tsx` — container with placeholder/loading/data states
- `ClassHeader.tsx` + `ClassHeader.test.tsx` — name, parent, source, description
- `ClassProperties.tsx` + `ClassProperties.test.tsx` — property list with add/edit/delete UI
- `ClassConflicts.tsx` + `ClassConflicts.test.tsx` — conflict comparison (graceful degradation)

## FAILURE CONDITIONS
- SHALL NOT skip specified test cases (5 + 7 + 7 + 3 = 22 tests)
- SHALL NOT use raw HTML rendering (V-222602)
- SHALL NOT crash on null/undefined data
- SHALL NOT display stale data without loading indicator
