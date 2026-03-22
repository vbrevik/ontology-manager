# Integration Notes: Opus Review Feedback

## Integrating (Changes to claude-plan.md)

### 1. Route placement → `/admin/ontology/browser` (Critical #1)
**Why:** The existing `/admin/ontology.tsx` layout route provides the full-height wrapper (`h-[calc(100vh-65px)]`, `overflow-hidden bg-background`) and `<Outlet />`. Creating a standalone `/ontology/browser` route would require duplicating this layout and potentially bypassing backend auth middleware. Using `/admin/ontology/browser` inherits the existing layout and auth.
**Change:** Update Section 2.2 to use `src/routes/admin/ontology/browser.tsx`.

### 2. Remove inline class name editing (Critical #2)
**Why:** Verified that `UpdateClassInput` has no `name` field — only `description`, `parent_class_id`, and `is_abstract`. The backend does not support class renaming via PUT. Adding backend support is out of scope.
**Change:** Remove name editing from Section 8.2. Keep description editing (which IS supported). ClassHeader renders name as read-only.

### 3. Remove ClassRelationships section (Critical #3)
**Why:** The relationships API is entity-level (`/api/ontology/entities/{id}/relationships`), not class-level. Classes define schema; entities are instances. There is no class-to-class relationships endpoint. Showing entity relationships for a class ID would return no results or errors.
**Change:** Remove Section 6.4 (ClassRelationships), remove `RelationshipColorMap.ts` from shared components, remove relationships query key from Section 3.1, remove relationships fetch from `useClassDetail`.

### 4. Add `version_id` handling for property creation (Significant #5)
**Why:** `CreatePropertyInput` requires `version_id`. The existing Classes page fetches it via `fetchCurrentVersion()`. The plan omitted this.
**Change:** Update `useClassDetail` hook to also fetch current version. Pass `version_id` to property creation mutations.

### 5. Reuse existing API functions (Minor #14)
**Why:** The existing `api.ts` already has `fetchClasses`, `getClass`, `fetchProperties`, `createProperty`, `updateProperty`, `deleteProperty`, `updateClass`. No need to reimplement.
**Change:** Add explicit note in Section 3 that hooks import from `@/features/ontology/lib/api`.

### 6. Add stale localStorage recovery (Significant #10)
**Why:** If a class is deleted, persisted `selectedClassId` would reference a non-existent class causing 404s. Simple defensive check.
**Change:** Add to OntologyBrowserContext: on class list load, if `selectedClassId` not found in list, clear to null.

### 7. Add error boundaries (Significant #9)
**Why:** With virtualization and complex state, crashes in tree or detail panel should be isolated. Standard React resilience pattern.
**Change:** Add error boundaries wrapping ClassTree and ClassDetail independently in OntologyBrowser layout.

### 8. Debounce prefetch on hover (Minor #13)
**Why:** With 500+ virtualized nodes, rapid scrolling could trigger excessive prefetch requests.
**Change:** Add 200ms debounce to hover prefetch in useClassDetail.

### 9. Add class creation flow (Minor #16)
**Why:** The existing Classes page has a "New Class" dialog. Since the browser replaces it, we need to preserve this capability.
**Change:** Add "New Class" button to the tree panel header, reusing the existing create class form pattern.

### 10. Clarify search as substring match (Minor #11)
**Why:** Spec said "fuzzy" but plan says "substring." Substring is simpler and sufficient for MVP.
**Change:** Explicitly note this is case-insensitive substring match, not fuzzy search.

### 11. Panel collapse expand mechanism (Minor #17)
**Why:** A panel collapsed to 0% width needs a visible way to re-expand.
**Change:** Add a collapse/expand toggle button in the panel resize handle area.

## NOT Integrating

### Query key naming (Significant #6)
**Why:** The plan's `['classes', 'list']` is fine and consistent with TanStack Query conventions. The spec's `['classes', 'tree']` was aspirational. The plan is the authority.

### Missing Subclasses section (Significant #7)
**Why:** Child classes are already visible in the tree itself (they're the children of the selected node). A separate "Subclasses" section in the detail panel would be redundant. The tree is the subclass browser.

### Conflict detection details (Significant #8)
**Why:** The Class interface has no conflict fields. This is correctly handled by the existing "graceful degradation" approach — the ConflictBadge and ClassConflicts section render nothing when conflict data is absent. When Split 01 adds source/conflict data, these components will activate without code changes. No plan update needed.

### `source_id` type extension (Significant #4)
**Why:** Already addressed by graceful degradation pattern. The plan correctly notes `source_id?` as optional. When Split 01 adds it to the API, the components will render. TypeScript types can use optional fields or intersection types — this is an implementation detail, not a plan-level concern.

### CSRF token gap (Minor #15)
**Why:** The backend enforces CSRF via middleware on all routes. The ontology CRUD functions work because the backend middleware validates CSRF tokens from cookies, not from explicit headers. Fixing the client-side CSRF headers is a separate concern and out of scope for the browser feature.

### `buildProxiedInstance` API check (Minor #12)
**Why:** Implementation detail. During implementation, we'll verify the @headless-tree/core API and use whatever the current version provides (`useTree`, `buildProxiedInstance`, etc.).
