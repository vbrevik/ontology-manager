# TDD Plan: Source Discovery API

Test-first approach mirroring the implementation plan sections. Tests use `#[sqlx::test]` for integration tests and standard `#[tokio::test]` for unit tests.

## Section 1: Database Migration Tests

**Test file:** inline in migration verification or `ontology_sources_test.rs`

1. **test_source_id_column_exists_on_classes** — After migration, `SELECT source_id FROM classes LIMIT 1` succeeds
2. **test_source_id_column_exists_on_properties** — Same for properties
3. **test_source_id_column_exists_on_relationship_types** — Same for relationship_types
4. **test_existing_data_has_null_source_id** — `SELECT COUNT(*) FROM classes WHERE source_id IS NULL` returns existing class count
5. **test_builtin_uniqueness_preserved** — INSERT two classes with same name, NULL source_id, same tenant/version → second INSERT fails
6. **test_different_sources_same_name_allowed** — INSERT class with source_id='a', then same name with source_id='b' → both succeed
7. **test_same_source_duplicate_blocked** — INSERT two classes with identical (name, tenant_id, version_id, source_id) → second fails
8. **test_ontology_sources_table_created** — `SELECT * FROM ontology_sources LIMIT 0` succeeds
9. **test_base_extension_mutual_exclusion** — INSERT with is_base=TRUE AND is_extension=TRUE → CHECK constraint fails
10. **test_only_one_base_allowed** — INSERT two rows with is_base=TRUE → second fails (partial unique index)
11. **test_properties_unique_constraint_updated** — Same property name for same class from different sources → allowed

## Section 2: Model Tests

**Test file:** `backend/src/features/ontology_sources/models.rs` (unit tests module)

1. **test_sources_config_deserialize** — Parse a valid sources.json string into `SourcesConfig`
2. **test_source_manifest_deserialize** — Parse a valid manifest.json string into `SourceManifest`
3. **test_manifest_with_missing_optional_fields** — Parse manifest missing `domain` and `stats` → succeeds with None
4. **test_manifest_files_as_hashmap** — Verify `files` field deserializes as `HashMap<String, String>`
5. **test_source_entry_active_field** — Verify `active: false` entries are parsed correctly

## Section 3: Service Tests

**Test file:** `backend/src/features/ontology_sources/service.rs` (unit tests) + `backend/tests/ontology_sources_test.rs` (integration)

### Discovery (unit-style with temp dirs)

6. **test_discover_valid_sources** — Create temp dir with sources.json + two source dirs with manifests → returns 2 sources, both `available: true`
7. **test_discover_broken_symlink** — Create temp dir with sources.json pointing to nonexistent path → returns source with `available: false`
8. **test_discover_missing_manifest** — Source dir exists but no manifest.json → source returned with available=true but partial metadata
9. **test_discover_missing_sources_json** — No sources.json in data dir → returns empty vec, no error
10. **test_discover_inactive_source_excluded** — Source with `active: false` in sources.json → excluded from results
11. **test_discover_timeout_on_slow_fs** — Mock slow file read → source marked unavailable after 500ms timeout

### Active source management (integration with DB)

12. **test_set_base_source** — Call `set_active_sources({base: "src-1"})` → `is_base=true` for src-1
13. **test_set_base_clears_previous** — Set src-1 as base, then src-2 → src-1 no longer base
14. **test_set_extension** — Set base + extension → both flags correct on different rows
15. **test_set_base_null_clears** — Set base to None → no row has is_base=true
16. **test_get_active_empty** — No active sources → returns `{base: null, extension: null}`
17. **test_sync_sources_upsert** — Discover → sync to DB → discover again → no duplicates

## Section 4: Route Tests

**Test file:** `backend/tests/ontology_sources_test.rs`

18. **test_get_sources_requires_auth** — GET /api/ontology-sources without JWT → 401
19. **test_get_sources_returns_list** — GET with JWT → 200 with array of sources
20. **test_get_active_returns_empty** — GET /api/ontology-sources/active → 200 with null base/extension
21. **test_put_active_sets_base** — PUT /api/ontology-sources/active with `{base: "src-1"}` → 200, base set
22. **test_put_active_invalid_source** — PUT with nonexistent source_id → 404
23. **test_put_active_requires_auth** — PUT without JWT → 401

## Section 5-6: Config and Integration Tests

24. **test_config_default_data_dir** — Config with no `ontology_data_dir` set → defaults to "./data"
25. **test_config_custom_data_dir** — Set `APP_ONTOLOGY_DATA_DIR` → Config reads it
26. **test_service_in_test_services** — `setup_services(pool)` returns `TestServices` with `source_service` field

## Test Execution Order

Tests should be written and run in this order:
1. Migration tests (Section 1) — verify schema changes
2. Model tests (Section 2) — verify deserialization
3. Service unit tests (Section 3, discovery) — verify filesystem logic
4. Service integration tests (Section 3, active sources) — verify DB interactions
5. Route tests (Section 4) — verify HTTP layer
6. Config tests (Section 5-6) — verify integration

Each section's tests are written RED first, then implementation makes them GREEN.
