# 03-mpcg-web — Web Application Spec

## Overview

React + Vite web application for browsing, visualizing, validating, and querying MPCG context graphs. Runs locally, consumes the API server.

## Features

### Feature 1: Taxonomy Browser

**Purpose:** Explore the MPCG type hierarchy interactively.

- Interactive collapsible tree view of node types and edge types
- Each type shows: name, description, parent chain, subtypes
- Search/filter by name or description
- Click a type to see: which scenarios use it, its domain/range constraints, algebraic properties
- Color-coding by top-level category (Entity=blue, Occurrence=green, Condition=orange, Information=purple, Force=red, Role=grey)
- Badge showing usage count across scenarios

### Feature 2: Graph Visualizer

**Purpose:** See an MPCG graph as interactive nodes and edges.

- Paste JSON into an editor pane OR load from scenario browser
- Force-directed graph layout (react-force-graph or similar)
- Nodes colored by type category, sized by edge count
- Edge labels showing relationship type
- Click a node to see its full properties, type, temporal data, security marking
- Click an edge to see its properties, weight, security
- Zoom, pan, drag nodes
- Layout options: force-directed, hierarchical, radial
- Security filter: slider or dropdown to set simulated clearance level, nodes/edges above that level fade out

### Feature 3: Live Validator

**Purpose:** Validate MPCG graphs in real-time.

- JSON editor pane (Monaco or CodeMirror) with syntax highlighting
- As you type, validation runs on debounce (300ms)
- Errors shown inline (red markers) and in a panel below
- Warnings shown as yellow markers
- Error categories: SCHEMA, TYPE, REF, UNIQUE, DOMAIN, RANGE, SECURITY, ORPHAN
- Quick-fix suggestions where possible (e.g., "Did you mean 'Person'?" for typo in type)
- Validate button for manual trigger
- Import from file (drag-and-drop JSON file)

### Feature 4: Query Interface

**Purpose:** Run queries against loaded graphs.

- Predefined queries:
  - "Find all contradictions"
  - "Show beliefs held by [agent]" (agent selector)
  - "Trace provenance of [node]" (node selector)
  - "Follow causal chain from [node]"
  - "What's visible at [classification level]?"
  - "Find all [edge type] relationships"
  - "List nodes of type [type]"
- Results displayed as: table view AND highlighted subgraph in the visualizer
- Query history

### Feature 5: Scenario Browser

**Purpose:** Browse and explore the 56 test scenarios.

- List view grouped by domain group
- Each scenario shows: id, group, subgroup, description excerpt, entity count, relationship count
- Click to expand: full description, expected entities table, expected relationships table
- "Load into Visualizer" button — encodes the scenario as a sample graph and opens in Feature 2
- "Validate scenario types" — checks that all expected types exist in the schema
- Filter by group, search by description

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  MPCG Explorer                        [Taxonomy] [Graph]    │
│                                       [Validate] [Query]    │
│                                       [Scenarios]           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Active feature panel fills this space]                     │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Tab-based navigation between the 5 features.

## Tech Stack

- **React 18+** with hooks
- **Vite** for dev server and build
- **react-force-graph-2d** or **@react-sigma/core** for graph visualization
- **Monaco Editor** or **CodeMirror 6** for JSON editing
- **Tailwind CSS** or **shadcn/ui** for styling
- **react-query** or **SWR** for API data fetching

## API Integration

All data from `http://localhost:3001/api/` (the 02-mpcg-api server).

## Project Structure

```
packages/web/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api/             ← API client functions
│   │   └── client.js
│   ├── components/
│   │   ├── TaxonomyBrowser.jsx
│   │   ├── GraphVisualizer.jsx
│   │   ├── LiveValidator.jsx
│   │   ├── QueryInterface.jsx
│   │   └── ScenarioBrowser.jsx
│   ├── hooks/            ← Custom hooks for API data
│   └── utils/            ← Type colors, formatting helpers
└── tests/
```

## Success Criteria

1. `npm run dev` opens the app at localhost:5173
2. Taxonomy browser shows all 144 node types in a navigable tree
3. Pasting a valid MPCG graph shows it as an interactive visualization
4. Pasting an invalid graph shows errors with line numbers
5. Running "Find contradictions" on a loaded graph highlights contradiction edges
6. Clicking a scenario loads it into the visualizer
7. Security filter hides nodes above selected clearance level
