# Ontology Browser — Usage Guide

## Quick Start

Navigate to `/admin/ontology/browser` in the web app to access the Ontology Browser.

## Features

### Tree Panel (Left)
- **Class hierarchy tree** — virtualized, supports thousands of nodes
- **Search** — type in the search bar to filter classes by name (300ms debounce)
- **Source filter** — dropdown to filter by ontology source
- **New Class button** — opens dialog to create a new class
- **Keyboard navigation** — Arrow keys, Enter to select, Home/End

### Detail Panel (Right)
- **Class header** — name (read-only), parent class link, source badge
- **Inline description editing** — click to edit, Enter/blur to save, Escape to cancel
- **Properties list** — add, edit, delete with optimistic updates
- **Conflict display** — shows when class has conflicting definitions from multiple sources

### State Persistence
All UI state persists in localStorage:
- Panel sizes (automatic via react-resizable-panels)
- Expanded tree nodes (debounced 300ms)
- Selected class
- Source filter
- Label mode (name vs description)

## Component Architecture

```
OntologyBrowser
├── OntologyBrowserProvider (context: selectedClassId, labelMode)
├── ClassTree
│   ├── ClassTreeSearch (search + source filter)
│   ├── ClassTreeNode (individual tree items)
│   └── CreateClassDialog
├── ClassDetail
│   ├── ClassHeader (name, parent link, description editing)
│   ├── ClassProperties (property CRUD)
│   └── ClassConflicts (conflict display)
└── Shared Components
    ├── EditableText (click-to-edit pattern)
    ├── SourceBadge (colored badge from sourceId hash)
    ├── ConflictBadge (warning icon with tooltip)
    └── ClassLink (button-styled navigation link)
```

## Data Layer

- `useClassTree()` — fetches class list, builds tree, manages search/filter/expanded state
- `useClassDetail(classId)` — fetches class detail, properties, version; provides mutations with optimistic updates
- `useLocalStorage(key, default)` — reusable localStorage hook with JSON parse/error handling

## Running Tests

```bash
# Unit + integration tests (Vitest)
cd frontend && pnpm vitest run

# E2E tests (Playwright, requires running server)
cd frontend && pnpm playwright test tests/ontology-browser.spec.ts
```

## Test Coverage

- 19 Vitest test files, 144 passing tests
- 7 Playwright E2E specs (require running backend)
