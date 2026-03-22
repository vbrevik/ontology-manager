# Ontology Browser — Complete Specification

## Overview

Redesigned frontend ontology browsing experience replacing the existing `/admin/ontology/Classes` page. Uses a master-detail layout inspired by Protege's best UX patterns, built as a modern React application that surpasses it in clarity, speed, and intuitiveness. Supports inline editing of classes and properties.

## Core Requirements

### Layout
- Master-detail split panel using `react-resizable-panels` (already installed, v4.4.1)
- Left panel: class hierarchy tree with search and filter controls
- Right panel: class detail with properties, relationships, source badges, conflict indicators
- Panel sizes persist in localStorage across sessions
- Responsive: works on any screen size

### Class Hierarchy Tree
- **Library:** `@headless-tree/core` + `@tanstack/react-virtual` for virtualization
- **Data source:** Fetch flat class list from `GET /api/ontology/classes`, build hierarchy client-side from `parent_class_id` fields
- **Performance:** Must handle 500+ classes without degradation (virtualization required)
- **Expand/collapse:** Arrow key navigation, click to toggle, state persisted in localStorage
- **Search:** Fuzzy text search on class names/labels (client-side)
- **Source filter:** Dropdown to filter tree by source_id (show only classes from selected source)
- **Accessibility:** Full WAI-ARIA treeview pattern — `role="tree"`, `role="treeitem"`, `role="group"`, roving tabindex, keyboard navigation (Up/Down/Left/Right/Home/End/Enter)
- **Visual indicators per node:**
  - Source badge (colored by source_id hash)
  - Conflict icon (⚠️) when class exists in multiple sources
  - Expand/collapse chevron for parent nodes

### Class Detail Panel
- **Data fetching:** Hybrid approach — tree provides summary (id, name, parent, source_id), detail panel fetches properties and relationships separately on class selection
  - `GET /api/ontology/classes/{id}` for full class data
  - `GET /api/ontology/classes/{classId}/properties` for properties
  - `GET /api/ontology/entities/{id}/relationships?direction=both` for relationships
- **Sections:**
  - **Header:** Class name (editable), parent class link, source badge, description (editable)
  - **Properties:** List with types and constraints (editable — add/edit/remove)
  - **Subclasses:** Clickable links to child classes
  - **Relationships:** Grouped by type, color-coded, with clickable target class links
  - **Conflicts:** Side-by-side comparison when class exists in multiple sources (base vs extension definition, resolution status)

### Inline Editing
- Click-to-edit on class name, description in the detail header
- Add/edit/remove properties inline in the properties section
- Uses existing API endpoints: `PUT /api/ontology/classes/{id}`, `POST/PUT/DELETE /api/ontology/properties`
- Optimistic updates via TanStack Query mutations with rollback on error

### Global Selection Model
- React Context (`OntologyBrowserContext`) holds currently selected class ID
- Selecting in tree → updates detail panel
- Clicking any class reference (ClassLink) in detail → navigates tree and updates detail
- Last selected class persisted in localStorage

### Hypertext Navigation
- All class/type references in the detail panel are clickable `ClassLink` components
- Clicking navigates: sets selected class → tree scrolls to and highlights node → detail panel updates
- Fluid cross-navigation between related classes

### Source Badges
- Small colored badge on each class indicating source origin
- Color derived from hash of source_id (consistent across sessions)
- Abbreviated source name (e.g., "SYS" for system-ontology)
- Clicking badge activates source filter (shows only classes from that source)
- **Graceful degradation:** When source_id is not available in API responses, badges are hidden and source filter is disabled

### Conflict Indicators
- Tree node shows ⚠️ icon when class name exists in multiple sources
- Detail panel shows "Conflict" section with side-by-side comparison
- Shows base definition, extension definition, resolution status
- **Graceful degradation:** When conflict data is not in API responses, conflict UI is hidden

### Relationship Color Coding
- Each relationship type gets a distinct color from a predefined palette
- Colors defined in `RelationshipColorMap.ts`, deterministic by name hash for unknown types
- Consistent across the application

### Render-by-Label Toggle
- Toggle between showing class `name` vs `description` as the display text in tree and detail

## Technical Decisions

### Data Fetching Strategy
- TanStack Query v5 with existing query client (5min staleTime)
- Tree query: `['classes', 'tree']` — fetch all classes, build hierarchy client-side
- Detail queries: `['classes', 'detail', classId]`, `['classes', classId, 'properties']`, `['classes', classId, 'relationships']`
- `placeholderData: keepPreviousData` on detail queries to avoid loading flashes during navigation
- `enabled: !!selectedClassId` for conditional detail fetching
- Prefetch on hover for tree nodes (properties/relationships)

### Routing
- New route: `/ontology/browser` — replaces `/admin/ontology/Classes` as primary class view
- Old `/admin/ontology/Classes` route deprecated (redirect or remove)
- File-based route via TanStack Router: `src/routes/ontology/browser.tsx`

### State Persistence (localStorage)
- Panel sizes (react-resizable-panels built-in persistence)
- Tree expanded node IDs
- Last selected class ID
- Source filter selection

### Component Location
```
frontend/src/features/ontology/components/
├── OntologyBrowser.tsx          -- Main layout: resizable split panel
├── ClassTree/
│   ├── ClassTree.tsx            -- Tree container with search bar
│   ├── ClassTreeNode.tsx        -- Individual tree node rendering
│   ├── ClassTreeSearch.tsx      -- Search input + source filter dropdown
│   └── useClassTree.ts          -- Hook: fetch classes, build hierarchy, manage expand state
├── ClassDetail/
│   ├── ClassDetail.tsx          -- Detail panel container
│   ├── ClassHeader.tsx          -- Class name, parent link, source badge, description (editable)
│   ├── ClassProperties.tsx      -- Properties list (editable)
│   ├── ClassRelationships.tsx   -- Relationships grouped by type, color-coded
│   ├── ClassConflicts.tsx       -- Conflict comparison panel
│   └── useClassDetail.ts        -- Hook: fetch class details, properties, relationships
├── shared/
│   ├── SourceBadge.tsx          -- Colored badge showing source origin
│   ├── ConflictBadge.tsx        -- Warning badge for conflicts
│   ├── ClassLink.tsx            -- Clickable class reference (hypertext nav)
│   └── RelationshipColorMap.ts  -- Color assignments for relationship types
└── OntologyBrowserContext.tsx    -- Global selection state + localStorage persistence
```

## Dependencies
- Split 01 (source-discovery-api): source_id in class responses, source metadata — **graceful degradation if not available**
- Split 02 (import-engine): imported data to display — **works with existing data regardless**
- New npm packages: `@headless-tree/core`, `@headless-tree/react`, `@tanstack/react-virtual`

## Existing Infrastructure to Leverage
- `react-resizable-panels` 4.4.1 (already installed)
- Shadcn/UI components: Badge, Card, ScrollArea, Input, Button, DropdownMenu, Tooltip, Sheet
- Existing ontology API functions in `src/features/ontology/lib/api.ts`
- `cn()` utility for classname merging
- Lucide React icons
- Vitest + @testing-library/react for unit tests
- Playwright for E2E tests

## Constraints
- Must use existing Shadcn + Tailwind component library
- Must use TanStack Query for data fetching (existing pattern)
- Must work with existing backend API (no new endpoints)
- Tree must handle 500+ classes without performance issues (virtualization)
- Full WAI-ARIA treeview accessibility compliance
- Graceful degradation when source/conflict data is unavailable

## Deliverables
1. OntologyBrowser layout with resizable panels (persistent sizes)
2. ClassTree with @headless-tree, virtualization, search, source filter
3. ClassDetail with properties, relationships, source badges, conflicts
4. Inline editing for class name, description, properties
5. Global selection context with hypertext navigation and localStorage persistence
6. Relationship color coding
7. Route at /ontology/browser replacing /admin/ontology/Classes
8. Unit tests (Vitest) and E2E tests (Playwright)
