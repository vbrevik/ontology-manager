# Specification: Ontology Browser as Core Feature

## Background

The ontology browser is the primary tool users interact with for exploring the class hierarchy, viewing class details, and understanding relationships. It is currently located at `/admin/ontology/browser`, buried under the admin panel alongside governance and security tools. This makes it feel like an admin-only feature rather than the core of the application.

## Requirements

### R1: New Top-Level Route

Create a new route at `/ontology` that renders the existing `OntologyBrowser` component. This is a file-based TanStack Router route (`src/routes/ontology.tsx`). No sub-routes — tab switching within the detail panel is internal component state, not URL-driven.

### R2: Navigation Placement

Add "Ontology" to `MainSidebar` as the second navigation item (after Dashboard, before Projects). Uses a lucide-react icon (e.g., `Network` or `GitBranch`). Active state detection follows existing `pathname.startsWith('/ontology')` pattern.

```
Dashboard    (/)
Ontology     (/ontology)
Projects     (/projects)
Targeting    (/targeting)
...rest unchanged
```

### R3: Remove Old Route

Delete `src/routes/admin/ontology/browser.tsx`. The TanStack Router Vite plugin will auto-regenerate `routeTree.gen.ts`. The admin "Approvals" workspace sidebar keeps its existing items (Classes, Relationships, Graph, Designer, Contexts, Versions) but has no browser link to remove (it was never added to the sidebar).

### R4: Detail Panel Tabs

When a class is selected in the browser, the detail panel shows a tab bar using the existing shadcn `Tabs` component:

| Tab | Content | Status |
|-----|---------|--------|
| Detail | Existing ClassDetail content (ClassHeader, ClassProperties, ClassConflicts) | Working |
| Graph | Visual stub: icon + "Graph visualization coming soon" description | Stub |
| Relationships | Visual stub: icon + "Relationship explorer coming soon" description | Stub |

When no class is selected, the existing "Select a class to view details" placeholder shows — no tab bar visible.

The tab state is managed locally via the shadcn Tabs `defaultValue` prop (uncontrolled). The tree panel on the left is unaffected by tab selection.

### R5: Authentication

The `/ontology` route redirects unauthenticated users to `/login`. This follows the pattern used by other protected routes. No permission-level changes — any authenticated user can access the ontology browser.

### R6: Test Updates

Update existing test files to reflect the route change:
- Integration test (`OntologyBrowser.integration.test.tsx`): No route-dependent assertions to change (tests mock the component tree directly).
- Playwright E2E spec (`tests/ontology-browser.spec.ts`): Update `page.goto('/admin/ontology/browser')` to `page.goto('/ontology')`.
- Add a test verifying the tab bar renders when a class is selected, with three tabs visible.

## Scope Exclusions

- Graph visualization implementation (future cycle)
- Relationship explorer implementation (future cycle)
- Changes to admin governance routes (`/admin/ontology/*`)
- Changes to dashboard, projects, targeting, or any other section
- Auth/permission model changes
- MainSidebar redesign (only adding one item)

## Follow-up Work

The Graph and Relationships tabs are stubs. They will be implemented in subsequent planning cycles once this restructure is stable.
