# Implementation Plan: Ontology Browser as Core Feature

## Problem

The ontology-manager application has a class hierarchy browser that lets users explore ontology classes, view details, and manage properties. This browser currently lives at `/admin/ontology/browser` — nested three levels deep inside the admin panel, alongside access control and security governance tools. Users must navigate to Administration → Approvals workspace → then find the browser (which isn't even in the sidebar). This placement contradicts the browser's role as the primary user-facing tool.

## Solution

Promote the ontology browser to a top-level route at `/ontology` with primary navigation placement. Add a tabbed detail panel to prepare for future graph and relationship views. Keep schema governance (versions, designer, approvals) under `/admin/ontology/*`. Add a redirect from the old URL to prevent broken bookmarks.

## Architecture

The application uses TanStack Router v1 with file-based routing. Routes in `frontend/src/routes/` map directly to URL paths. The Vite plugin auto-generates `frontend/src/routeTree.gen.ts` on file changes.

The current navigation has two layers:
- **MainSidebar** (authenticated root): Dashboard, Projects, Administration, System Metrics, Logs, AI
- **Admin workspaces** (`/admin/*`): Access Control, Approvals (ontology), Security, System Status, AI

After this change:
- **MainSidebar**: Dashboard, **Ontology**, Projects, Administration, System Metrics, Logs, AI
- **Admin workspaces**: unchanged (Approvals keeps governance routes)

**Auth model:** The application uses `AuthProvider` at the root level. There are no per-route auth guards in the codebase — routes rely on the root-level auth state. The `/ontology` route follows the same pattern. If additional auth protection is desired, a component-level check can redirect to `/login`, but this is consistent with how other routes like `/projects` work (no route-level guard).

## Section 1: Route Creation, Redirect, and Cleanup

### New Route File

Create `frontend/src/routes/ontology.index.tsx` — a leaf route (not a layout route) at `/ontology`. Using `.index.tsx` because there are no child routes; the tab switching is internal component state.

```typescript
// Route definition shape (not full implementation)
export const Route = createFileRoute('/ontology/')({
  component: OntologyPage,
})
```

The `OntologyPage` component renders the existing `OntologyBrowser` directly. The component already handles its own full-width split-pane layout (tree + detail panels), so no additional layout wrapper is needed.

### Redirect from Old URL

Replace the contents of `frontend/src/routes/admin/ontology/browser.tsx` with a redirect to `/ontology`. This prevents broken bookmarks and shared URLs. Use TanStack Router's `redirect` in `beforeLoad`:

```typescript
// Redirect shape
export const Route = createFileRoute('/admin/ontology/browser')({
  beforeLoad: () => { throw redirect({ to: '/ontology' }) },
})
```

### Files

| File | Action |
|------|--------|
| `frontend/src/routes/ontology.index.tsx` | Create — new top-level leaf route |
| `frontend/src/routes/admin/ontology/browser.tsx` | Modify — replace with redirect |
| `frontend/src/routeTree.gen.ts` | Auto-regenerated |

## Section 2: Navigation Update

### MainSidebar

In `frontend/src/components/layout/MainSidebar.tsx`, add an "Ontology" nav item as the second entry in the items array.

The existing sidebar structure uses an array of objects with `label`, `href`, `icon` fields. Active state detection uses `location.pathname.startsWith(href)`. The icon should be from `lucide-react` — recommend `Network` (fits the graph/hierarchy concept).

```typescript
// Nav item shape
{ label: 'Ontology', href: '/ontology', icon: Network }
```

Insert after Dashboard (`/`) and before Projects (`/projects`).

### Admin Workspace Sidebar

In `frontend/src/components/layout/WorkspaceSidebars.tsx`, verify that the Approvals workspace sidebar (`ApprovalsWorkspaceSidebar`) does not have a browser link. Research confirmed it doesn't — the browser was only accessible via direct URL navigation. No change needed here, but verify during implementation.

### Files

| File | Action |
|------|--------|
| `frontend/src/components/layout/MainSidebar.tsx` | Modify — add nav item |
| `frontend/src/components/layout/WorkspaceSidebars.tsx` | Verify — no browser link to remove |

## Section 3: Detail Panel Tabs

### Tab Structure

When a class is selected in the browser, the right-side detail panel currently renders `ClassDetail` (which contains `ClassHeader`, `ClassProperties`, `ClassConflicts`). This becomes the "Detail" tab. Two additional tabs are added as visual stubs.

Use the existing shadcn `Tabs` component from `@/components/ui/tabs` (standard Radix-based shadcn implementation with `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` exports).

### Tab State Reset

Use `key={selectedClassId}` on the `Tabs` component to force remount when the selected class changes. This ensures the tab resets to "Detail" when switching classes, preventing users from seeing a stub tab for a newly selected class.

```typescript
// Tab state pattern (shape only)
<Tabs defaultValue="detail" key={selectedClassId}>
  <TabsList>...</TabsList>
  <TabsContent value="detail">...</TabsContent>
  <TabsContent value="graph">...</TabsContent>
  <TabsContent value="relationships">...</TabsContent>
</Tabs>
```

### Tab Layout

```
┌──────────────────────────────────────┐
│ [Detail]  [Graph]  [Relationships]   │  ← TabsList (pinned, no scroll)
├──────────────────────────────────────┤
│                                      │
│  (tab content, scrollable)           │  ← TabsContent with overflow-y-auto
│                                      │
└──────────────────────────────────────┘
```

- **Detail tab**: Renders existing `ClassHeader`, `ClassProperties`, `ClassConflicts` content unchanged.
- **Graph tab**: Visual stub — lucide icon + "Graph visualization" heading + brief description. Muted styling.
- **Relationships tab**: Visual stub — lucide icon + "Relationship explorer" heading + brief description. Muted styling.

### Scroll Behavior

The tab bar (TabsList) stays pinned at the top of the detail panel. The tab content area gets `overflow-y-auto` for scrolling. The outer container uses `flex flex-col h-full` with the TabsList as a fixed-height header and TabsContent as `flex-1 overflow-y-auto`.

### Where to Add Tabs

Modify `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx`. The tab bar wraps the existing content. When no class is selected (`!selectedClassId`), render the existing placeholder without tabs.

### Tab Visibility

Tabs only appear when a class is selected. The "Select a class to view details" placeholder renders without any tab bar.

### Files

| File | Action |
|------|--------|
| `frontend/src/features/ontology/components/ClassDetail/ClassDetail.tsx` | Modify — wrap content in Tabs |

## Section 4: Testing

### Unit Tests

Add tests for the tab bar behavior in `ClassDetail`:
- When a class is selected, three tabs render (Detail, Graph, Relationships)
- Detail tab is active by default and shows class content
- Graph and Relationships tabs render placeholder content
- When no class is selected, no tabs render
- Switching classes resets to Detail tab (key-based remount)

These go in the existing `frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx`.

### Integration Test Update

The integration test at `frontend/src/features/ontology/components/OntologyBrowser.integration.test.tsx` doesn't reference the route path directly (it renders the component tree with mocked data). Verify it still passes.

### Playwright E2E Update

In `frontend/tests/ontology-browser.spec.ts`, update:
- `page.goto('/admin/ontology/browser')` → `page.goto('/ontology')`
- Add a test verifying that selecting a class shows three tabs in the detail panel

### Files

| File | Action |
|------|--------|
| `frontend/src/features/ontology/components/ClassDetail/ClassDetail.test.tsx` | Modify — add tab tests |
| `frontend/src/features/ontology/components/OntologyBrowser.integration.test.tsx` | Verify — no changes expected |
| `frontend/tests/ontology-browser.spec.ts` | Modify — update route path, add tab test |

## Implementation Order

1. **Section 1 (Route)** — Create new route, redirect old one. Foundation.
2. **Section 2 (Navigation)** — Add sidebar item. Quick, testable.
3. **Section 3 (Tabs)** — Detail panel tab structure. Independent of routing.
4. **Section 4 (Testing)** — Verify everything works together.

Sections 1-2 can be done together. Section 3 is independent UI work. Section 4 validates the whole change.

## Risk Assessment

**Moderate risk.** The components are well-isolated, but this is a breaking URL change. Mitigations:
- Redirect from old URL prevents broken bookmarks
- All existing unit tests continue to pass (they test components, not routes)
- The `OntologyBrowser` component is unchanged — only its mount point moves
- The main risk is `routeTree.gen.ts` auto-regeneration — run `pnpm tsr generate` if the dev server isn't running
