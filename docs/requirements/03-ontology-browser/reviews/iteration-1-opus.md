# Opus Review

**Model:** claude-opus-4
**Generated:** 2026-03-21T20:40:00Z

---

# Implementation Plan Review: Ontology Browser

## Critical Issues

### 1. Routing architecture mismatch -- the new route will not work as described

The plan proposes creating a route at `src/routes/ontology/browser.tsx` (path `/ontology/browser`), placing it **outside** the `/admin/` prefix. However, the existing app has no `/ontology` layout route -- there is only `/admin/ontology.tsx` which provides the full-height layout wrapper. The new route would render directly under the root layout (Navbar + Footer + Breadcrumbs), without the workspace sidebar, header, or the `h-[calc(100vh-65px)]` height constraint that `/admin/ontology.tsx` provides.

This means either:
- You need to create a new `src/routes/ontology.tsx` layout route that provides equivalent chrome (sidebar, header, height), or
- You place the browser under `/admin/ontology/browser.tsx` to inherit the existing layout.

The plan does not address this. Moving outside `/admin/` also raises a question about auth guards -- if the admin layout includes any authentication/authorization checks (check the `AuthProvider` and whether admin routes have `beforeLoad` guards), the new route might bypass them.

**Recommendation:** Explicitly decide whether this route lives under `/admin/ontology/` or standalone, and document what layout/auth wrapper it needs. Given the existing infrastructure, `/admin/ontology/browser` would be much simpler.

### 2. UpdateClassInput does not support updating `name`

Section 8.2 says "Name edit: `PUT /api/ontology/classes/{id}` with updated name field." But the existing `UpdateClassInput` interface only supports `description`, `parent_class_id`, and `is_abstract`. There is no `name` field.

Either the backend does not support renaming classes via PUT, or the frontend type is incomplete. The plan assumes name editing works but has not verified the backend contract.

**Recommendation:** Verify the backend endpoint accepts `name` in the update payload. If not, either add backend support or remove inline name editing from the plan.

### 3. Relationships endpoint is for entities, not classes

Section 3.3 says to fetch relationships via `GET /api/ontology/entities/{classId}/relationships?direction=both`. But this is the **entity** relationships endpoint, not a class-level relationships endpoint. The `classId` from the tree is a class ID, not an entity ID. The existing `fetchEntityRelationships` function uses `/api/ontology/entities/{id}/relationships` -- these are fundamentally different objects.

Classes define schema; entities are instances. A class does not have relationships in the same way an entity does. The plan conflates the two.

**Recommendation:** Clarify what "relationships" means for a class in this context. If you want to show which relationship types are valid between classes, you need a different endpoint (or derive it from schema metadata).

## Significant Concerns

### 4. No `source_id` field exists on the Class type

The `Class` interface has no `source_id` field. The plan mentions graceful degradation, which is good, but the tree building algorithm lists `source_id?` as part of the expected shape. The plan should explicitly state: (a) whether `source_id` will be added to the API response as part of Split 01, (b) what the Class type extension looks like, and (c) how to type this cleanly.

### 5. `version_id` is required for property creation but not addressed

The existing `CreatePropertyInput` requires a `version_id` field. Section 8.3 describes "Add property" but does not mention `version_id`. The plan needs to either fetch the current version or explain how it gets the `version_id`.

### 6. Query key inconsistency between plan and spec

The plan uses `['classes', 'list']` for the flat class list (Section 3.1), but the spec uses `['classes', 'tree']`. Pick one and be consistent.

### 7. Missing "Subclasses" section from the spec

The spec lists "Subclasses: Clickable links to child classes" as a detail panel section, but the implementation plan in Section 6 does not include a Subclasses component.

### 8. Conflict detection logic is unspecified

Section 6.5 says "Only rendered when conflict data is present on the class" but never defines what this conflict data looks like, where it comes from, or how to detect it.

### 9. No error boundaries

The plan has no mention of React error boundaries. If the tree or detail panel throws, the entire page will crash. With virtualization and complex state management, this is a real risk.

**Recommendation:** Add error boundaries wrapping the tree and detail panel independently.

### 10. Stale localStorage `selectedClassId`

If a class is deleted, the persisted `selectedClassId` will reference a non-existent class. The plan does not address this case.

**Recommendation:** Add a check: if the fetched class list does not contain the persisted `selectedClassId`, clear it to `null`.

## Minor Issues

### 11. Search is substring, spec says fuzzy

The spec says "Fuzzy text search" but the plan implements "case-insensitive substring match." Resolve the inconsistency explicitly.

### 12. `buildProxiedInstance` may not exist in `@headless-tree/core`

Verify this function exists in the version you plan to install. The more common API involves `useTree` from `@headless-tree/react`.

### 13. Prefetch on hover performance

With 500+ nodes, rapid scrolling could trigger hundreds of prefetch requests. The hover handler should be debounced (200-300ms).

### 14. No mention of existing ontology API functions

The existing `api.ts` already has `fetchClasses`, `getClass`, `fetchProperties`, etc. The plan should explicitly state these will be reused.

### 15. Missing CSRF tokens on some existing API calls

The ontology CRUD functions use bare `fetch` without CSRF tokens. The plan claims all mutations include CSRF tokens, but this is not true for the ontology endpoints.

### 16. No class creation flow

The existing Classes page has a "Create Class" dialog. The plan replaces this page but only mentions inline editing. There is no mention of creating or deleting classes.

### 17. Panel collapse behavior needs detail

A collapsed panel at 0% width has no visible handle. The plan does not describe the expand mechanism.

## Summary

The most urgent items to resolve before implementation:

1. **Route placement** -- decide `/admin/ontology/browser` vs `/ontology/browser` and create the necessary layout
2. **Class name editing** -- verify backend supports it; `UpdateClassInput` currently has no `name` field
3. **Relationships endpoint confusion** -- the plan uses an entity endpoint for class-level data
4. **Version ID for property creation** -- must be sourced from somewhere
5. **Stale localStorage recovery** -- handle deleted/missing classes gracefully

The plan is well-structured overall and the technology choices are sound. The graceful degradation approach for source/conflict data is good forward-thinking design. The main risks are around API contract assumptions that do not match the existing codebase.
