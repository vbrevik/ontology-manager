# Research Findings: Ontology Browser

## Part 1: Codebase Analysis

### Frontend Architecture

**Stack:** React 19 + TypeScript + Vite 7 + Tailwind v4 (OKLCH) + Shadcn/UI (33 components)

**Structure:** Feature-based organization under `src/features/`, file-based routing via TanStack Router, Shadcn components in `src/components/ui/`.

**Key patterns:**
- `cn()` utility (clsx + tailwind-merge) for conditional classnames
- Context providers: AuthProvider → AiProvider → ContextProvider (wrapping app in `__root.tsx`)
- API functions in feature `lib/api.ts` files, direct `fetch()` calls with CSRF tokens
- TanStack Query v5 with 5min default staleTime, 1 retry

### Existing Ontology Code

**Location:** `src/features/ontology/`
```
components/
  CustomNodes.tsx       -- ReactFlow node types (EntityNode, ClassNode, ContextNode)
  CustomEdges.tsx       -- Animated edges
  NodeEditSheet.tsx     -- Edit dialog
  EntityPropertyForm.tsx
  NodeContextMenu.tsx
lib/
  api.ts               -- All ontology API endpoints (733 lines)
  graphUtils.ts        -- Dagre layout utilities
  ai.ts                -- AI generation helpers
styles/
  graph-animations.css
```

**Existing routes:** Under `/admin/ontology/` — Classes (30KB), Contexts (36KB), Graph (19KB), Relationships, Designer, Versions.

**Graph visualization:** ReactFlow v11 + Dagre for auto-layout, custom node types (EntityNode blue, ClassNode orange, ContextNode blue), context menu, mini-map.

### Ontology API Endpoints

- `GET/POST /api/ontology/classes` — list/create
- `GET/PUT/DELETE /api/ontology/classes/{id}` — CRUD
- `GET /api/ontology/classes/{classId}/properties` — class properties
- `POST/PUT/DELETE /api/ontology/properties` — property CRUD
- `GET/POST /api/ontology/entities` — entity list/create
- `GET/PUT/DELETE /api/ontology/entities/{id}` — entity CRUD
- `GET /api/ontology/entities/{id}/descendants` — descendants with depth
- `GET /api/ontology/entities/{id}/relationships?direction=both` — relationships
- `POST/DELETE /api/ontology/relationships` — relationship CRUD
- `GET /api/rebac/relationship-types` — relationship types
- `GET/POST /api/ontology/versions` — version management

### Key Dependencies Already Installed

- `react-resizable-panels` 4.4.1
- `reactflow` 11.11.4 + `dagre` 0.8.5
- `@tanstack/react-query` 5.90.18
- `@tanstack/react-router` 1.132.0
- `lucide-react` 0.544.0 (icons)
- `recharts` 3.6.0, `date-fns` 4.1.0, `cmdk` 1.1.1

### Testing Setup

- **Unit:** Vitest 3.0.5 + jsdom + @testing-library/react + @testing-library/jest-dom
- **E2E:** Playwright 1.44.0 (base URL: http://127.0.0.1:5300)
- Setup file: `src/test/setup.ts`
- Coverage: v8 provider

### Shadcn/UI Components Available

Forms: Input, Textarea, Button, Label, Select, Checkbox, Switch
Dialogs: Dialog, Sheet, AlertDialog, Popover
Navigation: Tabs, DropdownMenu, NavigationMenu
Display: Badge, Card, Alert, ScrollArea, Table
Advanced: Command, Calendar, **Resizable**, Breadcrumb, Separator, Tooltip, Progress, Toast

---

## Part 2: Web Research

### 1. React Tree Component Libraries (2025)

**Three main options:**

| Library | Philosophy | Virtualization | Accessibility | Best For |
|---------|-----------|---------------|---------------|----------|
| **react-arborist** | Batteries-included, VS Code-style | Built-in (react-window) | Good | Quick file-explorer, <500 nodes |
| **react-complex-tree** | Unopinionated, data-provider pattern | Manual integration needed | Built-in W3C | Multiple trees, async data |
| **@headless-tree/core** | Fully headless, plugin-based | First-class @tanstack/react-virtual | Best W3C compliance | Large trees (500+), custom UI |

**Recommendation for this project:** `@headless-tree/core` + `@tanstack/react-virtual` — the spec requires 500+ node handling, custom UI (source badges, conflict indicators), and we need full control over rendering. The plugin architecture means we only pay for features we use.

**Key features of headless-tree:**
- Feature plugins: `selectionFeature`, `hotkeysCoreFeature`, `syncDataLoaderFeature`
- `getContainerProps()` and `item.getProps()` for automatic ARIA attributes
- `buildProxiedInstance` for lazy item creation (memory optimization)
- Keyboard: arrow keys, Home/End, typeahead search, Shift+arrows for multi-select

**Alternative:** Custom implementation is viable since the tree structure is well-defined (class hierarchy), but a library handles keyboard navigation and accessibility correctly out of the box.

### 2. react-resizable-panels Master-Detail Layout

**Already installed** (v4.4.1). Core API:
- `PanelGroup` (orientation="horizontal")
- `Panel` (defaultSize, minSize, maxSize, collapsible)
- `PanelResizeHandle` (draggable separator)

**Best practices:**
- Use pixel values for `minSize`/`maxSize` to prevent panels from becoming unusable
- `collapsible` + `collapsedSize={0}` for hide/show behavior
- `usePanelRef()` for imperative control (collapse/expand/resize)
- Persistence: `useDefaultLayout` hook with localStorage
- Nested layouts: alternate horizontal/vertical orientations
- Built-in accessibility: `role="separator"`, keyboard arrow keys to resize

### 3. TanStack Query Caching for Tree Navigation

**Query key strategy:**
```typescript
['classes', 'tree']           // Full tree hierarchy
['classes', 'detail', classId] // Single class detail
['classes', classId, 'properties'] // Class properties
['classes', classId, 'relationships'] // Class relationships
```

**Key patterns:**
- `staleTime: 5-10 min` for tree data (avoid refetches on navigation)
- `placeholderData: keepPreviousData` — show previous detail while loading new one (no flash)
- `enabled: !!selectedId` — conditional detail query, only when a class is selected
- Prefetch on hover: `queryClient.prefetchQuery()` for child nodes
- Cache seeding: when fetching tree, seed individual class caches with `setQueryData`
- `select` transform: extract only needed fields to prevent unnecessary re-renders

**Optimistic updates:** For tree mutations (rename, move), use `onMutate` to snapshot + update cache, `onError` to rollback, `onSettled` to invalidate.

### 4. Accessible Tree View ARIA Patterns (W3C WAI-ARIA APG)

**Required structure:**
```
role="tree" (container, with aria-label)
  └── role="treeitem" (each node)
        aria-level="N" (1-based depth)
        aria-selected="true/false"
        aria-expanded="true/false" (ONLY on branch nodes, never leaves)
        tabindex="0" (focused item) or "-1" (all others)
        └── role="group" (child container, NOT role="tree")
```

**Keyboard interaction (WAI-ARIA specification):**
- Down/Up Arrow: navigate visible items
- Right Arrow: expand closed branch → move to first child → do nothing on leaf
- Left Arrow: collapse open branch → move to parent on closed/leaf
- Enter: activate/select
- Home/End: first/last visible item
- Type-ahead: focus matching item

**Roving tabindex:** Only one treeitem has `tabindex="0"` at a time. Arrow keys move focus and swap tabindex values.

**Common mistakes:**
1. Setting `aria-expanded` on leaf nodes
2. Missing `role="group"` on child containers (using `role="tree"` instead)
3. Multiple `tabindex="0"` items
4. Missing `aria-label` on tree container
5. Not implementing Left/Right arrow expand/collapse

---

## Sources

- [react-arborist](https://github.com/brimdata/react-arborist)
- [react-complex-tree](https://github.com/lukasbach/react-complex-tree)
- [Headless Tree](https://headless-tree.lukasbach.com)
- [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [W3C WAI-ARIA APG Treeview](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
