# Integration Notes

## Integrating

1. **Fix Tabs claim** — Correct. The shadcn Tabs IS Radix-based. Will fix.
2. **Add redirect** — Good catch. Will add a redirect route from old path to new.
3. **Auth pattern** — Will clarify that no route-level guard exists in the codebase; auth is handled by AuthProvider at root level. The `/ontology` route follows the same pattern.
4. **File path prefix** — Will add `frontend/` prefix consistently.
5. **Tab state reset** — Good catch. Will use `key={selectedClassId}` on Tabs to force reset.
6. **Scroll behavior** — Will add note about pinning tab bar and scrolling content.
7. **Layout vs leaf** — Will use `ontology.index.tsx` since no child routes are needed.
8. **Risk assessment** — Will upgrade to moderate.

## NOT Integrating

- **Breadcrumb impact** — The Breadcrumbs component derives from the route path automatically. "Ontology" is a reasonable breadcrumb for the new location. No special handling needed.
- **Active state collision (pre-existing)** — The Admin/AI active state bug is pre-existing and out of scope.
- **File path consistency for E2E** — The plan already uses `frontend/tests/` for Playwright specs.
