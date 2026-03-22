Now I have all the context needed. Let me generate the section content.

# Section 2: Navigation Update

## Overview

This section adds an "Ontology" navigation item to the MainSidebar component, placing it as the second entry (after Dashboard, before Projects). It also confirms that no cleanup is needed in the admin workspace sidebar.

**Depends on:** Section 01 (Route and Redirect) -- the `/ontology` route must exist before linking to it.

## Background

The application has two navigation layers:

- **MainSidebar** (`frontend/src/components/layout/MainSidebar.tsx`): The primary sidebar rendered for all authenticated users. Contains a `mainNavItems` array of objects with `label`, `href`, and `icon` fields. Active state is determined by `location.pathname.startsWith(href)`, with a special case for the root `/` path.
- **WorkspaceSidebars** (`frontend/src/components/layout/WorkspaceSidebars.tsx`): Context-specific sidebars for admin workspaces. The `ApprovalsWorkspaceSidebar` handles ontology governance routes (`/admin/ontology/*`) but does not contain a link to the browser -- the browser was only reachable via direct URL.

The sidebar uses `lucide-react` icons. The `Network` icon is already imported in `WorkspaceSidebars.tsx` and is a good semantic fit for an ontology/graph concept.

## Tests

Per the TDD plan, no dedicated unit tests are required for this section. The MainSidebar is a presentational component whose nav items are verified visually and through E2E tests (covered in Section 04). The verification of `WorkspaceSidebars.tsx` is a manual code inspection confirming no browser link exists.

## Implementation

### File: `frontend/src/components/layout/MainSidebar.tsx`

**Action:** Modify -- add "Ontology" nav item as the second entry in `mainNavItems`.

Two changes are required:

1. **Add `Network` to the lucide-react import.** The current imports are `LayoutDashboard`, `FolderKanban`, `Settings`, `FileText`, `Activity`, `ChevronLeft`, `ChevronRight`, `Sparkles`. Add `Network` to this list.

2. **Insert the Ontology nav item into `mainNavItems`.** Place it at index 1 (after Dashboard, before Projects):

```typescript
{
    label: 'Ontology',
    href: '/ontology',
    icon: Network,
}
```

The resulting `mainNavItems` array order should be:

1. Dashboard (`/`)
2. **Ontology (`/ontology`)** -- new
3. Projects (`/projects`)
4. Administration (`/admin`)
5. System Metrics (`/stats/system`)
6. System Logs (`/logs`)
7. AI Orchestrator (`/admin/ai`)

**Active state behavior:** The existing `isActive` function uses `location.pathname.startsWith(href)`. Since `/ontology` does not collide with any other route prefix, this works correctly without modification. The Ontology item will highlight when the user is on `/ontology` or any path starting with `/ontology`.

### File: `frontend/src/components/layout/WorkspaceSidebars.tsx`

**Action:** Verify only -- no changes needed.

The `ApprovalsWorkspaceSidebar` component (lines 171-186) contains links to:
- Context Approvals (`/admin/ontology/contexts`)
- Ontology Designer (`/admin/ontology/designer`)
- Classes (`/admin/ontology/Classes`)
- Relationships (`/admin/ontology/Relationships`)
- Schema Versions (`/admin/ontology/versions`)

There is no link to `/admin/ontology/browser` in this sidebar. The browser was previously only accessible via direct URL navigation. No removal or modification is needed here.

## Verification Checklist

- The MainSidebar renders "Ontology" as the second item after "Dashboard"
- Clicking "Ontology" navigates to `/ontology`
- The Ontology item highlights (active state) when on the `/ontology` route
- The collapsed sidebar shows the Network icon with "Ontology" as the title tooltip
- The `ApprovalsWorkspaceSidebar` is unchanged and contains no browser link
- No other sidebar or navigation component references `/admin/ontology/browser`