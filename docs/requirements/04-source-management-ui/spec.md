# 04: Source Management UI

## Overview

Two frontend components for managing ontology data sources: a sidebar quick-switch for fast ontology changes, and a dedicated `/ontology-sources` management page for browsing, importing, and configuring sources.

## Scope

### In Scope
- **Sidebar quick-switch:** compact widget in the existing workspace/context switcher showing active ontology with one-click switch
- **Management page** at `/ontology-sources`: card-based layout showing all available sources with metadata, stats, and actions
- Import action: trigger import of a source (calls split 02 API)
- Remove action: unload an imported source (calls split 02 API)
- Layer action: set a source as extension on top of current base
- Status indicators: imported/not imported, active/inactive, available/unavailable
- Error handling: show clear messages when a source is unavailable (broken symlink)

### Out of Scope
- Backend API endpoints (splits 01, 02)
- Ontology browser (split 03)
- Adding new sources (manual symlink setup for now)
- Editing source manifest files

## Technical Details

### Sidebar Quick-Switch

Extends the existing workspace/context switcher area in the sidebar. Small, always-visible widget:

```
┌─────────────────────────┐
│ 📦 Ontology             │
│ ┌─────────────────────┐ │
│ │ 🟦 system-ontology  │ │  ← active base, clickable
│ │ + mpcg-ontology     │ │  ← extension badge (if layered)
│ └─────────────────────┘ │
│ [Change...]             │  ← opens dropdown or navigates to management page
└─────────────────────────┘
```

**Dropdown behavior** on "Change...":
- Lists all available sources from `GET /api/ontology-sources`
- Each shows name, domain, format badge
- Selecting one triggers import as base (with confirmation dialog)
- "Manage sources →" link at bottom navigates to `/ontology-sources`

### Management Page (`/ontology-sources`)

Full-page layout with source cards:

```
┌──────────────────────────────────────────────────────────────────┐
│  Ontology Sources                                    [Refresh]   │
│                                                                  │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│  │ 🟦 ontology-manager-system  │ │ 🟧 multi-perspective-context│ │
│  │ v1.0.0                      │ │ v2.0.0                      │ │
│  │                              │ │                              │ │
│  │ System ontology for the      │ │ A typed property graph       │ │
│  │ platform — access control,   │ │ ontology for representing    │ │
│  │ identity, operations...      │ │ context across perspectives  │ │
│  │                              │ │                              │ │
│  │ Format: JSON                 │ │ Format: JSON Schema          │ │
│  │ Domain: platform-operations  │ │ Domain: universal-context    │ │
│  │                              │ │                              │ │
│  │ 38 classes · 170 properties  │ │ 20 node types · 25 edges    │ │
│  │ 19 relationship types        │ │ 70 scenarios                 │ │
│  │                              │ │                              │ │
│  │ ✅ Imported · 🔵 Base       │ │ ⬜ Not imported              │ │
│  │                              │ │                              │ │
│  │ [Reimport] [Remove]          │ │ [Import as Base]             │ │
│  │                              │ │ [Import as Extension]        │ │
│  └─────────────────────────────┘ └─────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────┐                                 │
│  │ ⚠️ custom-domain-ontology   │                                 │
│  │                              │                                 │
│  │ Source unavailable            │                                 │
│  │ (directory not found)         │                                 │
│  │                              │                                 │
│  │ Path: ./data/custom-domain   │                                 │
│  └─────────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
frontend/src/features/ontology-sources/
├── components/
│   ├── SourceSwitcher.tsx         -- Sidebar quick-switch widget
│   ├── SourceSwitcherDropdown.tsx  -- Dropdown for quick switching
│   ├── SourceCard.tsx             -- Card for management page
│   ├── SourceStatusBadge.tsx      -- Imported/active/unavailable badges
│   ├── SourceFormatBadge.tsx      -- JSON/JSON-Schema format indicator
│   ├── SourceStatsRow.tsx         -- Stats display (classes, properties, etc.)
│   ├── ImportDialog.tsx           -- Confirmation dialog before import
│   └── ImportProgressIndicator.tsx -- Shows import progress/result
├── lib/
│   └── api.ts                    -- API client functions for ontology-sources endpoints
├── hooks/
│   ├── useOntologySources.ts     -- TanStack Query hook for source list
│   └── useImportSource.ts        -- TanStack Mutation hook for import/remove actions
└── pages/
    └── OntologySourcesPage.tsx    -- Main management page
```

### Actions and Flows

#### Import as Base
1. User clicks "Import as Base" on a source card
2. `ImportDialog` shows: "This will replace the current base ontology. Continue?"
3. On confirm: `POST /api/ontology-sources/{id}/import?role=base`
4. `ImportProgressIndicator` shows progress
5. On success: card updates to show "✅ Imported · 🔵 Base", stats refresh
6. If conflicts with extension: show conflict count with link to browser

#### Import as Extension
1. User clicks "Import as Extension" on a source card
2. Requires a base to already be imported
3. `ImportDialog` shows: "This will layer {name} on top of {base_name}. Continue?"
4. On confirm: `POST /api/ontology-sources/{id}/import?role=extension`
5. On success: card shows "✅ Imported · 🟣 Extension"
6. If conflicts detected: show conflict summary with link to browser's conflict view

#### Remove
1. User clicks "Remove" on an imported source card
2. Confirmation: "Remove {name}? This will delete all imported classes, properties, and relationships from this source."
3. On confirm: `DELETE /api/ontology-sources/{id}/import`
4. Card updates to "⬜ Not imported"

#### Quick-Switch (Sidebar)
1. User clicks "Change..." in sidebar widget
2. Dropdown shows available sources
3. Selecting a source triggers "Import as Base" flow (with swap confirmation)
4. Sidebar widget updates to show new active source

### Data Fetching

- `useOntologySources()` → `GET /api/ontology-sources` (cached, refetch on import/remove)
- `useImportSource()` → TanStack useMutation wrapping POST/DELETE import endpoints
- After mutation success: invalidate sources query to refresh all cards

### Routing

New route: `/ontology-sources` — management page
Registered in the TanStack Router file-based routing system.

Navigation menu entry under the existing ontology section.

### Integration with Existing UI

The `SourceSwitcher` widget integrates into the existing sidebar layout:
- Place it in `MainSidebar.tsx` or `WorkspaceSidebars.tsx` (whichever handles the current context/workspace display)
- Uses the same visual style as the existing workspace switcher
- Compact by default, expands to dropdown on interaction

## Constraints
- Must use existing Shadcn Card, Badge, Button, Dialog components
- Must use TanStack Query for data fetching (existing pattern)
- Must not block the main UI during import (show progress indicator)
- Source cards must handle long descriptions gracefully (truncate with expand)
- Must work when zero sources are available (empty state)

## Dependencies
- Split 01: `GET /api/ontology-sources`, `PUT /api/ontology-sources/active`
- Split 02: `POST /api/ontology-sources/{id}/import`, `DELETE /api/ontology-sources/{id}/import`
- Split 03: ontology browser exists for navigation after import

## Deliverables
1. SourceSwitcher sidebar widget with dropdown
2. OntologySourcesPage with card layout
3. SourceCard with status badges and action buttons
4. ImportDialog with confirmation and progress
5. API client hooks (useOntologySources, useImportSource)
6. Route registration and navigation menu entry
