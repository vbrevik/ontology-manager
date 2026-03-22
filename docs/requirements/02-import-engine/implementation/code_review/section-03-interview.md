# Section 03 Code Review Interview

## Triage Summary

| Finding | Decision | Action |
|---------|----------|--------|
| First-error-only validation | Auto-fix | Accumulate all errors, return joined |
| walk_edge_types ignores active_set | Let go | By design — MPCG edge types don't have abstract/concrete |
| Hardcoded string data_type | Let go | Taxonomy format doesn't provide types |
| No orphan parent class validation | Auto-fix | Added check in validate_and_sort |
| No duplicate property/RT check | Let go | Same prop name on different classes is valid |
| validate_parsed discards sort result | Auto-fix | Renamed to validate_and_sort, returns sorted ParsedOntology |
| parse_cardinality no validation | Let go | Values from controlled source files |
| Duplicate make_manifest helper | Let go | Test code, not production |
| Stack overflow on deep input | Let go | Taxonomies are shallow in practice |

## Applied Fixes

1. **Renamed `validate_parsed` → `validate_and_sort`**: Now takes ownership of `ParsedOntology`, returns sorted version with classes in topological order
2. **Error accumulation**: All validation errors collected into a Vec and joined with "; " before returning
3. **Orphan parent validation**: Added check that class parent_name references exist in the class set
