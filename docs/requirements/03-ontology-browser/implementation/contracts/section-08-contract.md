# Section 08: State Persistence — Prompt Contract

## GOAL
Add localStorage persistence for expanded tree nodes (debounced), source filter. Create useLocalStorage utility hook. Write persistence tests. OntologyBrowserContext already persists selectedClassId and labelMode from section-03.

## CONTEXT
OntologyBrowserContext already has localStorage for selectedClassId and labelMode with stale selection recovery. This section adds expanded nodes persistence to useClassTree and source filter persistence to useClassTree/ClassTreeSearch.

## CONSTRAINTS
- Debounce expanded node writes (300ms)
- Try/catch all localStorage access
- Fall back to defaults on corrupt data
- No external dependencies for debounce (useRef + setTimeout)

## FORMAT
- `frontend/src/features/ontology/components/useLocalStorage.ts` (create)
- `frontend/src/features/ontology/components/statePersistence.test.ts` (create)
- `frontend/src/features/ontology/components/ClassTree/useClassTree.ts` (modify)

## FAILURE CONDITIONS
- SHALL NOT break existing tests
- SHALL NOT throw errors on corrupt localStorage data
- SHALL NOT write to localStorage synchronously on every expand/collapse
