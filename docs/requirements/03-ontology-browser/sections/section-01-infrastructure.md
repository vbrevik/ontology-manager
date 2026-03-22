Now I have all the context needed. Let me produce the section content.

# Section 01: Infrastructure

## Overview

This section sets up the foundation for the Ontology Browser feature: installing new npm dependencies, creating the TanStack Router route file, and scaffolding the directory structure for all components. No tests are needed for this section -- the TDD plan explicitly states: "No tests needed for dependency installation or route registration. Verify route renders after Section 4."

This section has no dependencies and blocks all other sections.

---

## 1. Install New Dependencies

Run the following from the `frontend/` directory:

```
pnpm add @headless-tree/core @headless-tree/react @tanstack/react-virtual
```

These three packages are new. The following relevant packages are already installed (no action needed):

- `react-resizable-panels` v4.4.1 (split layout)
- `@tanstack/react-query` v5 (data fetching)
- `@tanstack/react-router` (routing)
- `lucide-react` (icons)
- `@radix-ui/react-scroll-area` (scroll container)
- `@radix-ui/react-tooltip` (tooltips)
- `@radix-ui/react-dropdown-menu` (dropdowns)
- `@radix-ui/react-alert-dialog` (confirmation dialogs)

After installation, verify the packages appear in `frontend/package.json` under `dependencies`.

---

## 2. Create the Route File

Create a new file at:

```
frontend/src/routes/admin/ontology/browser.tsx
```

This file uses TanStack Router's file-based routing convention. The route path will be `/admin/ontology/browser`. It is rendered inside the existing layout route at `frontend/src/routes/admin/ontology.tsx`, which provides a full-height viewport wrapper (`h-[calc(100vh-65px)]`, `overflow-hidden bg-background`) and renders an `<Outlet />`.

The route file should:

1. Call `createFileRoute('/admin/ontology/browser')` with a `component` property pointing to a wrapper component.
2. The wrapper component should import and render `OntologyBrowser` from `@/features/ontology/components/OntologyBrowser`.
3. For now (before Section 3 implements the real component), use a placeholder that renders a simple div with text like "Ontology Browser" so the route is verifiable.

Stub signature:

```typescript
// frontend/src/routes/admin/ontology/browser.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/ontology/browser')({
  component: OntologyBrowserPage,
})

function OntologyBrowserPage() {
  // Placeholder until Section 03 implements OntologyBrowser
  return <div>Ontology Browser</div>
}
```

Once Section 03 is complete, this file will import and render the real `OntologyBrowser` component.

**Note on the existing Classes route:** The existing route at `frontend/src/routes/admin/ontology/Classes.tsx` should remain untouched for now. The browser is a new route alongside it. Redirecting or removing the old Classes page is a future cleanup task, not part of this implementation.

---

## 3. Create the Directory Structure

Create the following empty directories and placeholder files under `frontend/src/features/ontology/components/`. Each file should export a placeholder component (a named export with a simple div rendering the component name) so that imports resolve during incremental development.

```
frontend/src/features/ontology/components/
├── OntologyBrowser.tsx
├── OntologyBrowserContext.tsx
├── ClassTree/
│   ├── ClassTree.tsx
│   ├── ClassTreeNode.tsx
│   ├── ClassTreeSearch.tsx
│   └── useClassTree.ts
├── ClassDetail/
│   ├── ClassDetail.tsx
│   ├── ClassHeader.tsx
│   ├── ClassProperties.tsx
│   ├── ClassConflicts.tsx
│   └── useClassDetail.ts
├── shared/
│   ├── SourceBadge.tsx
│   ├── ConflictBadge.tsx
│   └── ClassLink.tsx
```

Each placeholder component file should follow this pattern (using `OntologyBrowser.tsx` as an example):

```typescript
// frontend/src/features/ontology/components/OntologyBrowser.tsx
export function OntologyBrowser() {
  return <div>OntologyBrowser placeholder</div>
}
```

Each placeholder hook file should follow this pattern:

```typescript
// frontend/src/features/ontology/components/ClassTree/useClassTree.ts
/** Hook: fetch classes, build tree hierarchy, manage search/filter state */
export function useClassTree() {
  // Implemented in Section 02
  return { treeItems: {}, rootIds: [], isLoading: true }
}
```

```typescript
// frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts
/** Hook: fetch class detail, properties, current version for selected class */
export function useClassDetail(_classId: string | null) {
  // Implemented in Section 02
  return { classData: null, properties: [], isLoading: true }
}
```

The context file placeholder:

```typescript
// frontend/src/features/ontology/components/OntologyBrowserContext.tsx
import { createContext, useContext } from 'react'

export interface OntologyBrowserContextValue {
  selectedClassId: string | null
  setSelectedClassId: (id: string | null) => void
  labelMode: 'name' | 'description'
  toggleLabelMode: () => void
}

export const OntologyBrowserContext = createContext<OntologyBrowserContextValue | null>(null)

export function useOntologyBrowser(): OntologyBrowserContextValue {
  const ctx = useContext(OntologyBrowserContext)
  if (!ctx) throw new Error('useOntologyBrowser must be used within OntologyBrowserProvider')
  return ctx
}
```

---

## 4. Tests

The TDD plan explicitly states: **"No tests needed for dependency installation or route registration."** Route rendering is verified in Section 04 after the tree component is implemented.

---

## 5. Verification Checklist

After completing this section, verify:

- [ ] `pnpm install` succeeds and `@headless-tree/core`, `@headless-tree/react`, `@tanstack/react-virtual` appear in `node_modules/`
- [ ] `frontend/src/routes/admin/ontology/browser.tsx` exists and TypeScript compiles without errors
- [ ] All placeholder files listed in Section 3 exist and export their named components/hooks
- [ ] `cd frontend && pnpm build` completes without errors (route generation picks up the new file)
- [ ] Navigating to `/admin/ontology/browser` in the dev server renders the placeholder text

---

## 6. Files Created/Modified

| Action | File Path |
|--------|-----------|
| Modified | `frontend/package.json` (new dependencies added by pnpm) |
| Created | `frontend/src/routes/admin/ontology/browser.tsx` |
| Created | `frontend/src/features/ontology/components/OntologyBrowser.tsx` |
| Created | `frontend/src/features/ontology/components/OntologyBrowserContext.tsx` |
| Created | `frontend/src/features/ontology/components/ClassTree/ClassTree.tsx` |
| Created | `frontend/src/features/ontology/components/ClassTree/ClassTreeNode.tsx` |
| Created | `frontend/src/features/ontology/components/ClassTree/ClassTreeSearch.tsx` |
| Created | `frontend/src/features/ontology/components/ClassTree/useClassTree.ts` |
| Created | `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx` |
| Created | `frontend/src/features/ontology/components/ClassDetail/ClassHeader.tsx` |
| Created | `frontend/src/features/ontology/components/ClassDetail/ClassProperties.tsx` |
| Created | `frontend/src/features/ontology/components/ClassDetail/ClassConflicts.tsx` |
| Created | `frontend/src/features/ontology/components/ClassDetail/useClassDetail.ts` |
| Created | `frontend/src/features/ontology/components/shared/SourceBadge.tsx` |
| Created | `frontend/src/features/ontology/components/shared/ConflictBadge.tsx` |
| Created | `frontend/src/features/ontology/components/shared/ClassLink.tsx` |

---

## 7. Dependencies and Blocked Sections

**This section depends on:** Nothing (first section in the execution order).

**This section blocks:** All other sections. Sections 02 through 09 require the dependencies, route, and directory structure created here.

**Key context for downstream sections:**
- The layout route at `frontend/src/routes/admin/ontology.tsx` provides `h-[calc(100vh-65px)] overflow-hidden bg-background` and renders `<Outlet />`. The browser route inherits this full-height container.
- The existing API layer at `frontend/src/features/ontology/lib/api.ts` contains all data fetching functions (`fetchClasses`, `getClass`, `fetchProperties`, `createProperty`, `updateProperty`, `deleteProperty`, `updateClass`, `createClass`, `fetchCurrentVersion`). No new API functions are needed.
- The `OntologyBrowserContext` interface defined here is the contract that Section 03 will implement and that Sections 04, 05, 06, and 07 will consume.