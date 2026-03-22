# Section 07: Inline Editing — Prompt Contract

## GOAL
Implement EditableText component, CreateClassDialog, wire EditableText into ClassHeader, add optimistic updates to useClassDetail mutations, add "New Class" button to ClassTree.

## CONTEXT
useClassDetail already has basic mutations (no optimistic updates). ClassHeader already has manual inline editing. ClassProperties already has add/edit/delete UI. This section upgrades these with a reusable EditableText, adds optimistic updates, and adds class creation.

## CONSTRAINTS
- Reuse existing Shadcn components (Dialog, Input, Textarea, AlertDialog)
- Use existing API functions from api.ts
- Optimistic updates with proper rollback on error
- Client-side validation before API calls
- Toast notifications on error using existing useToast

## FORMAT (files)
- `frontend/src/features/ontology/components/shared/EditableText.tsx` (create)
- `frontend/src/features/ontology/components/shared/EditableText.test.tsx` (create)
- `frontend/src/features/ontology/components/shared/CreateClassDialog.tsx` (create)
- `frontend/src/features/ontology/components/shared/CreateClassDialog.test.tsx` (create)
- `frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx` (modify — use EditableText)
- `frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts` (modify — add optimistic updates)
- `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` (modify — add New Class button)

## FAILURE CONDITIONS
- SHALL NOT use raw HTML injection or unsafe rendering
- SHALL NOT skip client-side validation
- SHALL NOT break existing tests
- SHALL NOT introduce form library dependencies (use useState)
