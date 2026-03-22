# 03: Ontology Browser

## Overview

Redesigned frontend ontology browsing experience using a master-detail layout. Inspired by Protege's best UX pattern but built as a modern React web application that surpasses it in clarity, speed, and intuitiveness.

## Scope

### In Scope
- Master-detail layout: tree panel (left) + detail panel (right)
- Class hierarchy tree with expand/collapse, search, and filter
- Global selection model: selecting a class updates all panels
- Detail panel: properties, relationships, description, annotations, source indicator
- Hypertext navigation: click any class/type reference to navigate to it
- Source indicators: visual badges showing which source each class comes from
- Conflict indicators: visual flags when layered sources define the same class
- Color-coded relationship types in the detail panel
- Relationship filter controls
- Render-by-label toggle (show name vs description)

### Out of Scope
- Source switching/management UI (split 04)
- Editing ontology data (existing feature, not modified)
- Graph visualization (future work — VOWL-inspired, separate project)
- Import/export functionality

## Design Principles

### Better than Protege
1. **No active ontology confusion** — source ownership is always visible as a colored badge on every class
2. **Instant, no loading screens** — React Query caching, optimistic updates
3. **Accessible to non-engineers** — clean typography, clear hierarchy, no jargon
4. **Responsive** — works on any screen size, resizable panels

### Adopted from Protege
1. **Master-detail tree + panel** — the proven navigation pattern
2. **Global selection** — click anywhere to navigate
3. **Hypertext cross-navigation** — entity references are clickable links

### Adopted from other tools
1. **VOWL-inspired color coding** (WebVOWL) — relationship types have distinct colors
2. **Properties inside class view** (OWLGrEd) — not a separate tab, shown in the detail panel
3. **Source badges** (TopBraid EDG) — clear visual distinction between ontology sources

## Technical Details

### Component Architecture

```
frontend/src/features/ontology/components/
├── OntologyBrowser.tsx          -- Main layout: resizable split panel
├── ClassTree/
│   ├── ClassTree.tsx            -- Tree container with search bar
│   ├── ClassTreeNode.tsx        -- Individual tree node (expand/collapse)
│   ├── ClassTreeSearch.tsx      -- Fuzzy search + filter controls
│   └── useClassTree.ts          -- Hook: fetch hierarchy, manage expand state
├── ClassDetail/
│   ├── ClassDetail.tsx          -- Detail panel container
│   ├── ClassHeader.tsx          -- Class name, parent, source badge, description
│   ├── ClassProperties.tsx      -- Properties list with types and constraints
│   ├── ClassRelationships.tsx   -- Relationships grouped by type, color-coded
│   ├── ClassConflicts.tsx       -- Conflict indicator panel (when layered)
│   └── useClassDetail.ts        -- Hook: fetch class details by ID
├── shared/
│   ├── SourceBadge.tsx          -- Colored badge showing source origin
│   ├── ConflictBadge.tsx        -- Warning badge for conflicting definitions
│   ├── ClassLink.tsx            -- Clickable class reference (hypertext nav)
│   └── RelationshipColorMap.ts  -- Color assignments for relationship types
└── OntologyBrowserContext.tsx    -- Global selection state (selected class ID)
```

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 Search classes...                    [Filter ▾] [Labels] │
├────────────────────┬─────────────────────────────────────────┤
│                    │                                         │
│  ▼ AccessControl   │  AccessControl                         │
│    ▸ Role          │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│    ▸ Permission    │  🟦 system-ontology  ⚠️ conflict       │
│    ▸ Resource      │                                         │
│  ▼ Identity        │  Base class for all access control      │
│    ▸ User          │  entities                               │
│    ▸ Group         │                                         │
│  ▼ Context         │  ── Properties ─────────────────────── │
│    ▸ Political...  │  (none — abstract class)                │
│    ▸ Crisis...     │                                         │
│    ▸ Operational.. │  ── Subclasses ─────────────────────── │
│  ▸ SecurityEvent   │  Role · Permission · Resource ·        │
│  ▸ Project         │  RelationshipType                      │
│  ▸ Task            │                                         │
│                    │  ── Relationships ──────────────────── │
│                    │  🟢 has_role: User → Role               │
│                    │  🟣 grants_permission: Role → Permission │
│                    │                                         │
└────────────────────┴─────────────────────────────────────────┘
```

### Global Selection Model

A React Context (`OntologyBrowserContext`) holds the currently selected class ID. All child components subscribe to this context:

- **ClassTree** highlights the selected node and scrolls to it
- **ClassDetail** fetches and displays the selected class
- **ClassLink** components throughout the detail panel set the selected class on click

This creates fluid navigation: click a relationship target → tree scrolls to it → detail panel updates.

### Source Badges

Each class shows a small colored badge indicating its source:
- Color is derived from a hash of the source_id (consistent across sessions)
- Badge shows abbreviated source name (e.g., "SYS" for system-ontology, "MPCG" for mpcg-ontology)
- Clicking the badge filters the tree to show only classes from that source

### Conflict Indicators

When a class name exists in both base and extension:
- Tree node shows a ⚠️ icon
- Detail panel shows a "Conflict" section with side-by-side comparison:
  - Base definition (properties, description)
  - Extension definition (properties, description)
  - Resolution status (unresolved / base wins / extension wins)

### Relationship Color Coding

Each relationship type gets a distinct color from a predefined palette:
- `has_role` → green
- `grants_permission` → purple
- `depends_on` → orange
- etc.
- Colors defined in `RelationshipColorMap.ts`, deterministic by name hash for new types

### Data Fetching

Uses TanStack Query for all data:
- `useClassTree` → `GET /api/ontology/classes?tree=true` (returns hierarchical structure)
- `useClassDetail` → `GET /api/ontology/classes/{id}?include=properties,relationships`
- Both queries include `source_id` in the response for badge display

### Routing

New route: `/ontology/browser` — the main browser view
Existing routes (`/ontology/classes`, etc.) remain unchanged for backwards compatibility.

## Constraints
- Must use existing Shadcn + Tailwind component library
- Must use TanStack Query for data fetching (existing pattern)
- Must work with existing backend API (no new endpoints beyond split 01)
- Left panel must be resizable (use react-resizable-panels, already in dependencies)
- Tree must handle 500+ classes without performance issues (virtualization if needed)

## Dependencies
- Split 01: source_id in API responses, source metadata
- Split 02: imported data to display

## Deliverables
1. OntologyBrowser layout component with resizable panels
2. ClassTree with search, filter, expand/collapse
3. ClassDetail with properties, relationships, source badges
4. Global selection context with hypertext navigation
5. Conflict indicator panel
6. Relationship color coding
7. Route registration at /ontology/browser
