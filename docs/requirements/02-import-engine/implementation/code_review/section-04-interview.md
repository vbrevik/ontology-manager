# Section 04 Code Review Interview

## Triage Summary

| Finding | Decision | Action |
|---------|----------|--------|
| Cross-source parent resolution | Auto-fix | Added DB fallback for parent/class refs |
| Extension orphan data | Auto-fix | Unload prev extension/base data before clearing flags |
| imported_at mismatch | Auto-fix | Use RETURNING imported_at from UPDATE |
| Conflicts allow duplicate rows | Let go | By design — informational, not blocking |
| No stats update | Let go | Future enhancement |
| No FK on source_conflicts | Let go | Schema change, separate migration |

## Applied Fixes

1. **Cross-source class resolution**: Parent class ID now falls back to DB lookup when not in local name_to_id map. Also added `resolve_class_id` helper for relationship type source/target class resolution.
2. **Previous role holder cleanup**: Before clearing is_base/is_extension on old source, delete its data (properties, relationship_types, classes, conflicts).
3. **imported_at from DB**: Use `RETURNING imported_at` to get server timestamp instead of application `Utc::now()`.
