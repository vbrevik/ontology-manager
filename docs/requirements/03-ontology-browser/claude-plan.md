# Implementation Plan: Ontology Browser

## 1. Overview

The Ontology Browser is a master-detail class browsing UI that replaces the existing `/admin/ontology/Classes` page. It provides a resizable split-panel layout with a virtualized class hierarchy tree on the left and a rich detail panel on the right. The browser supports inline editing of descriptions and properties, class creation, hypertext navigation between related classes, source badges, and conflict indicators.

The application is built with React 19, TypeScript, Tailwind v4, and Shadcn/UI components. It uses TanStack Router for file-based routing, TanStack Query v5 for data fetching, `@headless-tree/core` for the tree component, `@tanstack/react-virtual` for virtualization, and `react-resizable-panels` (already installed) for the split layout.

### Why This Approach

The existing Classes page is a flat CRUD table. The browser replaces it with a Protege-inspired master-detail pattern that shows class hierarchy, properties, and source provenance in a single view. Key design decisions:

- **Client-side tree building** from the flat class list (no new backend endpoints needed)
- **@headless-tree/core** chosen over react-arborist because it provides headless rendering (needed for custom source badges and conflict icons), first-class virtualization via @tanstack/react-virtual, and the best WAI-ARIA compliance
- **Hybrid data fetching**: tree loads all classes upfront (summary data), detail panel fetches properties on selection
- **Graceful degradation**: source badges and conflict indicators render only when `source_id` and conflict data are present in API responses, so the browser works regardless of whether Split 01 is deployed
- **Reuse existing API layer**: all data fetching and mutations use the existing functions in `@/features/ontology/lib/api` (`fetchClasses`, `getClass`, `fetchProperties`, `createProperty`, `updateProperty`, `deleteProperty`, `updateClass`, `createClass`, `fetchCurrentVersion`)
- **Error boundaries**: tree and detail panel are wrapped in independent error boundaries to prevent cascade failures

---

## 2. Infrastructure

### 2.1 New Dependencies

Install three new packages:

```
@headless-tree/core     # Headless tree state management
@headless-tree/react    # React bindings for headless-tree
@tanstack/react-virtual # Row virtualization for 500+ nodes
```

`react-resizable-panels` (v4.4.1) is already installed.

### 2.2 Route Registration

Create a new file-based route at `src/routes/admin/ontology/browser.tsx` using TanStack Router's `createFileRoute('/admin/ontology/browser')`. This places the browser under the existing `/admin/ontology` layout route, which provides the full-height viewport wrapper (`h-[calc(100vh-65px)]`, `overflow-hidden bg-background`) and inherits the admin layout's auth context.

The existing `/admin/ontology/Classes` route should redirect to `/admin/ontology/browser` (or be removed and the route tree updated).

### 2.3 Directory Structure

```
frontend/src/features/ontology/components/
├── OntologyBrowser.tsx              # Main layout: PanelGroup with two Panels
├── OntologyBrowserContext.tsx        # React Context for global selection + persistence
├── ClassTree/
│   ├── ClassTree.tsx                # Tree container: search bar + headless tree + virtualizer
│   ├── ClassTreeNode.tsx            # Single tree node renderer (badges, icons, expand chevron)
│   ├── ClassTreeSearch.tsx          # Search input + source filter dropdown
│   └── useClassTree.ts             # Hook: fetch classes, build hierarchy, manage state
├── ClassDetail/
│   ├── ClassDetail.tsx             # Detail panel container (routes to sections)
│   ├── ClassHeader.tsx             # Class name (read-only), parent link, source badge, editable description
│   ├── ClassProperties.tsx         # Editable properties list with types/constraints
│   ├── ClassConflicts.tsx          # Side-by-side conflict comparison (graceful degradation)
│   └── useClassDetail.ts          # Hook: fetch detail, properties, current version
├── shared/
│   ├── SourceBadge.tsx             # Colored badge from source_id hash
│   ├── ConflictBadge.tsx           # Warning icon for conflicts
│   └── ClassLink.tsx               # Clickable class reference (hypertext nav)
```

---

## 3. Data Layer

### 3.1 Query Key Strategy

```
['classes', 'list']                    # Flat class list for tree building
['classes', 'detail', classId]         # Full class data (name, description, parent, source_id)
['classes', classId, 'properties']     # Properties for selected class
['ontology-versions', 'current']       # Current version (needed for property creation)
['ontology-sources', 'list']           # Source metadata for badges (if available)
```

### 3.2 useClassTree Hook

**Responsibilities:**
1. Fetch flat class list from `GET /api/ontology/classes` using TanStack Query with `staleTime: 5 * 60 * 1000`
2. Build a tree structure client-side by grouping classes by `parent_class_id`. Root nodes have `parent_class_id === null`.
3. Provide the tree data in the format `@headless-tree/core` expects: an `items` record keyed by item ID, each with a `children` array of child IDs
4. Manage expanded node state (Set of expanded IDs) — initialized from localStorage, synced on change
5. Provide search/filter state: text filter on class name (case-insensitive substring match), source filter (selected source_id or null for all)
6. When filters are active, the tree should show matching nodes plus their ancestor path (so the tree structure remains navigable)

### 3.3 useClassDetail Hook

**Responsibilities:**
1. Accept `classId` from the OntologyBrowserContext
2. Fetch class detail: `GET /api/ontology/classes/{classId}` using existing `getClass()` — `enabled: !!classId`
3. Fetch properties: `GET /api/ontology/classes/{classId}/properties` using existing `fetchProperties()` — `enabled: !!classId`
4. Fetch current version: using existing `fetchCurrentVersion()` — needed for property creation (`version_id` is required by `CreatePropertyInput`)
5. Use `placeholderData: keepPreviousData` on detail and properties queries to prevent loading flashes during navigation
6. Prefetch properties on tree node hover via `queryClient.prefetchQuery()` — debounced at 200ms to avoid flooding during rapid scrolling
7. Provide mutation functions for inline editing (see Section 8)

### 3.4 Tree Building Algorithm

Given a flat array of classes with `{ id, name, parent_class_id, source_id?, description? }`:

1. Create a Map of id → class for O(1) lookup
2. Group classes by `parent_class_id` to build a children map
3. Root nodes are those where `parent_class_id` is null or references a non-existent parent
4. Convert to headless-tree format: `{ rootItem: 'root', items: { root: { children: [...rootIds] }, [id]: { children: [...childIds], data: classData } } }`
5. Sort children alphabetically by name at each level

---

## 4. Layout and Panels

### 4.1 OntologyBrowser Component

The main layout component renders a `PanelGroup` with horizontal orientation containing two `Panel` components separated by a `PanelResizeHandle`.

**Left panel (tree):**
- `defaultSize={30}` (percentage)
- `minSize={15}`, `maxSize={50}`
- `collapsible` with `collapsedSize={0}`
- Contains `ClassTree` wrapped in an error boundary
- Header area with "New Class" button for class creation

**Right panel (detail):**
- `defaultSize={70}`
- Contains `ClassDetail` wrapped in an error boundary

**Panel collapse/expand:** The `PanelResizeHandle` includes a toggle button (chevron icon) that collapses or expands the left panel. When collapsed to 0%, the toggle button remains visible on the left edge.

**Error boundaries:** Each panel is wrapped in an independent React error boundary. If the tree crashes (e.g., malformed data), the detail panel continues working, and vice versa. Error boundaries show a "Something went wrong" fallback with a retry button.

**Persistence:** Use the `autoSaveId` prop on `PanelGroup` to automatically persist panel sizes to localStorage under a key like `"ontology-browser-layout"`.

### 4.2 OntologyBrowserContext

A React Context that provides:

```typescript
interface OntologyBrowserContextValue {
  selectedClassId: string | null
  setSelectedClassId: (id: string | null) => void
  labelMode: 'name' | 'description'  // render-by-label toggle
  toggleLabelMode: () => void
}
```

On mount, initialize `selectedClassId` from localStorage. On change, persist to localStorage. This enables the "last selected class" memory across sessions.

**Stale selection recovery:** When the class list loads, if the persisted `selectedClassId` is not found in the list (e.g., the class was deleted), clear it to `null`. This prevents 404 errors from the detail panel queries.

The context wraps the entire `OntologyBrowser` component, so both tree and detail panel subscribe to it.

---

## 5. Tree Component

### 5.1 ClassTree

Container component that renders:
1. `ClassTreeSearch` at the top (search input + source filter + label toggle)
2. The headless tree with virtualization below

**Headless tree setup:**
- Use `buildProxiedInstance` from `@headless-tree/core` for lazy item creation (memory optimization for large trees)
- Enable features: `selectionFeature`, `hotkeysCoreFeature`, `syncDataLoaderFeature`
- Provide the tree items from `useClassTree` hook
- Connect selection to `OntologyBrowserContext.setSelectedClassId`

**Virtualization:**
- Use `useVirtualizer` from `@tanstack/react-virtual` with `estimateSize: () => 32` (32px per row)
- Container ref on a `ScrollArea` (Shadcn component)
- Absolute positioning with `translateY` for virtual items
- Provide `scrollToItem` callback for keyboard navigation compatibility

**ARIA compliance:**
- The headless tree's `getContainerProps()` provides `role="tree"` and `aria-label`
- Each item's `getProps()` provides `role="treeitem"`, `aria-expanded`, `aria-selected`, `aria-level`, and `tabindex` (roving tabindex pattern)
- Keyboard: Up/Down arrows navigate, Left/Right expand/collapse, Home/End jump to first/last, Enter selects, type-ahead search

### 5.2 ClassTreeNode

Renders a single tree item. Layout:
- Indentation based on `item.getItemMeta().level` (e.g., `paddingLeft: level * 20px`)
- Expand/collapse chevron icon (ChevronRight from Lucide, rotated 90deg when expanded) — only on nodes with children
- Class name (or description if label mode is 'description')
- Source badge (SourceBadge component) — only rendered if `source_id` is present on the class data
- Conflict icon (⚠️ or AlertTriangle from Lucide) — only rendered if class has conflict data

**Styling:**
- Highlight selected node with `bg-accent` class
- Hover state with `hover:bg-muted`
- Use `cn()` utility for conditional classes

### 5.3 ClassTreeSearch

Two controls:
1. **Search input** — Shadcn `Input` with search icon, debounced (300ms) text filter. Filters tree nodes by case-insensitive substring match on class name (not fuzzy search — substring is simpler and sufficient for MVP).
2. **Source filter** — Shadcn `DropdownMenu` with "All Sources" default plus one entry per unique source_id found in the class list. Each entry shows the source badge color + name. Selecting a source filters the tree to only show classes from that source (plus ancestor path). This dropdown is hidden entirely if no classes have `source_id` (graceful degradation).

---

## 6. Detail Panel

### 6.1 ClassDetail

Container that renders when a class is selected (`selectedClassId !== null`). Shows a placeholder message ("Select a class to view details") when nothing is selected.

Uses `useClassDetail` hook to fetch class data and properties. Shows a subtle loading skeleton (not a spinner) while data loads, using `isPlaceholderData` to distinguish between cached and loading states.

Renders three sections vertically:
1. `ClassHeader` — name, parent, source, description
2. `ClassProperties` — properties table
3. `ClassConflicts` — conflict comparison (only if conflicts exist, graceful degradation)

### 6.2 ClassHeader

Displays:
- **Class name** — large text, read-only (the backend `UpdateClassInput` does not support name changes)
- **Parent class** — `ClassLink` to navigate to parent in the tree
- **Source badge** — `SourceBadge` component (hidden if no source_id)
- **Description** — paragraph text, click-to-edit (see Section 8)

### 6.3 ClassProperties

A table/list of properties for the selected class. Each property row shows:
- Property name
- Type (e.g., string, integer, reference to another class → `ClassLink`)
- Constraints (required, unique, etc.)
- Edit/delete actions (see Section 7)

An "Add Property" button at the bottom opens an inline form.

### 6.4 ClassConflicts

Only rendered when conflict data is present on the class. Shows:
- Two columns: "Base Definition" and "Extension Definition"
- Each column shows the class properties and description as defined by each source
- Resolution status label (unresolved / base wins / extension wins)
- Hidden entirely when no conflict data exists (graceful degradation)

---

## 7. Shared Components

### 7.1 SourceBadge

A small `Badge` (Shadcn) component that:
- Takes `sourceId: string` and optional `sourceName: string`
- Generates a consistent background color from a hash of the sourceId (use a simple hash → HSL conversion with fixed saturation/lightness for readability)
- Displays abbreviated source name (first 3-4 chars uppercase, e.g., "SYS", "MPCG")
- On click, activates the source filter in the tree (via OntologyBrowserContext or callback)
- Renders nothing if sourceId is undefined/null

### 7.2 ConflictBadge

A warning indicator using `AlertTriangle` icon from Lucide with amber/yellow coloring. Wrapped in a `Tooltip` showing "This class has conflicting definitions from multiple sources."

### 7.3 ClassLink

An inline clickable element (styled as a link) that:
- Takes `classId: string` and `className: string`
- On click, calls `setSelectedClassId(classId)` from OntologyBrowserContext
- The tree then scrolls to and highlights the selected node
- Renders the class name as the link text
- Uses `text-primary underline-offset-4 hover:underline` styling

---

## 8. Inline Editing

### 8.1 Editing Pattern

Use a "click-to-edit" pattern throughout the detail panel:
- Display mode: text renders normally with a subtle edit icon on hover
- Edit mode: text is replaced by a Shadcn `Input` or `Textarea` with auto-focus
- Save: on blur or Enter key, call the mutation
- Cancel: on Escape key, revert to display mode
- Loading: show a subtle spinner during mutation, disable input

### 8.2 Class Description Editing

- **Description edit:** `PUT /api/ontology/classes/{id}` with updated description field using existing `updateClass()` function
- **Note:** Class name is read-only — `UpdateClassInput` only supports `description`, `parent_class_id`, and `is_abstract`
- Use TanStack Query `useMutation` with optimistic updates:
  - `onMutate`: cancel active queries, snapshot previous data, optimistically update cache
  - `onError`: rollback to snapshot
  - `onSettled`: invalidate `['classes', 'list']` and `['classes', 'detail', classId]` queries

### 8.3 Property Editing

- **Add property:** `POST /api/ontology/properties` using existing `createProperty()` — requires `version_id` from `fetchCurrentVersion()` (fetched by `useClassDetail` hook)
- **Edit property:** `PUT /api/ontology/properties/{id}` using existing `updateProperty()` with updated fields
- **Delete property:** `DELETE /api/ontology/properties/{id}` using existing `deleteProperty()` with confirmation dialog (Shadcn `AlertDialog`)
- All use optimistic updates on `['classes', classId, 'properties']` query
- Input validation: name required, type required from allowlist, constraints optional

### 8.4 Class Creation

A "New Class" button in the tree panel header opens a dialog (reusing the pattern from the existing Classes page):
- Class Name input (required)
- Description input (optional)
- Parent Class selector (optional — dropdown of existing classes)
- Abstract toggle (boolean)
- Uses existing `createClass()` function
- On success, invalidate `['classes', 'list']` and select the new class

### 8.5 Validation

Client-side validation using controlled React state (not a form library — the edits are simple single-field mutations):
- Description: optional, max 2000 characters
- Property name: required, max 255 characters
- Property type: required, must be from the set of valid types
- New class name: required, max 255 characters, no empty strings

Server-side validation is handled by the existing backend. On server error, show a toast notification (using the existing toast system) with the error message and rollback the optimistic update.

### 8.6 Security (STIG Compliance)

- All rendered content uses React's default JSX escaping — no raw HTML rendering
- All mutations use existing API functions which go through the backend's CSRF and auth middleware
- Input validation enforces length limits before submission

---

## 9. State Persistence

### 9.1 What Persists to localStorage

| Key | Value | Component |
|-----|-------|-----------|
| `ontology-browser-layout` | Panel sizes | PanelGroup autoSaveId (built-in) |
| `ontology-browser-expanded` | JSON array of expanded node IDs | useClassTree |
| `ontology-browser-selected` | Selected class ID string | OntologyBrowserContext |
| `ontology-browser-source-filter` | Selected source filter ID or null | ClassTreeSearch |
| `ontology-browser-label-mode` | `'name'` or `'description'` | OntologyBrowserContext |

### 9.2 Persistence Strategy

- Use a simple `useLocalStorage` utility hook (or inline `useEffect` + `useState` with `localStorage.getItem`/`setItem`)
- Read on mount, write on change (debounced for expanded nodes to avoid excessive writes during rapid expand/collapse)
- Handle missing/corrupt localStorage gracefully (fall back to defaults)

---

## 10. Testing Strategy

### 10.1 Unit Tests (Vitest + Testing Library)

**useClassTree hook:**
- Builds correct tree structure from flat class list
- Handles empty class list
- Filters by search text (matches name substring)
- Filters by source_id
- Filter shows matching nodes plus ancestor path
- Sorts children alphabetically

**useClassDetail hook:**
- Fetches detail, properties, and current version when classId is provided
- Does not fetch when classId is null
- Handles API errors gracefully

**Shared components:**
- SourceBadge: renders badge with correct color for given sourceId, renders nothing for null
- ConflictBadge: renders warning icon with tooltip
- ClassLink: calls setSelectedClassId on click

**Inline editing:**
- Click activates edit mode
- Enter/blur saves
- Escape cancels
- Shows error toast on mutation failure
- Optimistic update appears immediately

### 10.2 Component Tests (Vitest + Testing Library)

**ClassTree:**
- Renders tree nodes from class data
- Expand/collapse works on click and arrow keys
- Search filters visible nodes
- Keyboard navigation (Up/Down/Home/End)
- Selected node is highlighted

**ClassDetail:**
- Shows placeholder when no class selected
- Renders header, properties sections
- Renders conflict section only when conflict data present (graceful degradation)
- ClassLink navigation works

**OntologyBrowser:**
- Renders split panel layout
- Selection in tree updates detail panel

### 10.3 E2E Tests (Playwright)

- Navigate to `/admin/ontology/browser`, verify page loads
- Click a class in tree, verify detail panel updates
- Expand/collapse tree nodes
- Search for a class name, verify tree filters
- Click a ClassLink in detail, verify tree navigates
- Inline edit a class description, verify it persists
- Create a new class via dialog, verify it appears in tree
- Resize panels, reload page, verify sizes persist
- Keyboard navigation through tree (accessibility)

### 10.4 Test Data

Tests should use the existing test infrastructure (Vitest setup file at `src/test/setup.ts`). Mock API responses for unit tests using MSW or TanStack Query's test utilities. E2E tests hit the running dev server with real data.
