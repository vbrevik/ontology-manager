# Code Review: Section 02 - Data Layer

## Key Findings

### Auto-fix (applying now)
1. **createProperty guard** — Add guard preventing mutation when version not loaded
2. **Version query unconditional** — Add `enabled: !!classId` to version query
3. **Add `as` cast comments** — Document reason for type casts in test helpers and error aggregation

### Let go
- Duplicate classMap between buildClassTree and useClassTree (minor optimization, not worth the coupling)
- `'source_id' in cls` prototype chain concern (JSON objects only, no class instances)
- Mutation error exposure (section-07 will add optimistic updates with full error handling)
- Test coverage for availableSources and error propagation (can add later if needed)
- Property invalidation scope (properties are separate from class list/detail)
