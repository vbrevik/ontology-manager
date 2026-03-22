# Plan Contract: Ontology Browser

## GOAL
`claude-plan.md` must deliver a self-contained prose blueprint for implementing the Ontology Browser — a master-detail class browsing experience with tree navigation, inline editing, source badges, conflict indicators, and full accessibility. The plan drives all downstream section files and implementation.

## CONTEXT
This is the primary class browsing UI, replacing the existing `/admin/ontology/Classes` page. It integrates with existing backend APIs (no new endpoints) and must gracefully degrade when source/conflict data is unavailable. The plan must be implementable by an engineer or LLM with no prior context.

## CONSTRAINTS
- Plans are prose documents — zero full function implementations
- Must follow plan-writing.md guidelines (type definitions, signatures, directory structure only)
- Must specify @headless-tree/core + @tanstack/react-virtual as the tree library
- Must specify react-resizable-panels for the layout (already installed)
- Must follow existing codebase patterns: feature-based structure, TanStack Query, TanStack Router, Shadcn/UI, cn() utility
- Must address graceful degradation for source_id and conflict data
- Must include inline editing requirements
- Must address localStorage persistence for panel sizes, expanded nodes, selected class

## FORMAT
Single file `claude-plan.md` with sections that map to implementable units:
1. Infrastructure (new dependencies, route registration)
2. Data layer (hooks, queries, tree building)
3. Layout and panels
4. Tree component
5. Detail panel components
6. Shared components (badges, links, color map)
7. Inline editing
8. State persistence
9. Testing strategy

## FAILURE CONDITIONS
- SHALL NOT contain full function bodies
- SHALL NOT assume reader has prior context
- SHALL NOT omit testing strategy
- SHALL NOT add features beyond the spec
- SHALL NOT omit accessibility requirements
- SHALL NOT ignore graceful degradation for source/conflict data

## STIG Constraints

- V-222602 (CAT I): XSS — All rendered class names, descriptions, and user-supplied content must use React's default JSX escaping. Never render raw HTML from user input. Sanitize any rich text before display.
- V-222603 (CAT I): CSRF — All state-changing requests (PUT/POST/DELETE for inline editing) must include CSRF tokens. Existing fetch pattern includes credentials and CSRF headers — continue using it.
- V-222606 (CAT I): Input validation — All inline edit inputs (class name, description, properties) must be validated client-side AND rely on existing server-side validation. Enforce length limits and type constraints.
- V-222609 (CAT I): Input handling — Handle malformed API responses gracefully without crashing or exposing internals. Display user-friendly error messages.
