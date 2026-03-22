# Integration Notes: Opus Review Feedback

## Integrated

1. **NULL handling in unique constraint** (Critical #1) — Add two partial unique indexes instead of one composite. One for `source_id IS NULL`, one for `source_id IS NOT NULL`. This preserves built-in data uniqueness.

2. **Transaction for flag-swap** (Critical #3) — Explicitly wrap `set_active_sources` in `sqlx::Transaction`. Clear old flags + set new flags atomically.

3. **`create_test_config()` update** (#5) — Add `ontology_data_dir` field with `#[serde(default)]` and update test config.

4. **Clarify `active` field in sources.json** (#7) — `active` in sources.json = "include in discovery". `is_base`/`is_extension` in DB = "currently loaded". Document this distinction.

5. **CHECK constraint for mutual exclusivity** (#8) — Add `CHECK (NOT (is_base AND is_extension))` to ontology_sources table.

6. **Add indexes on source_id** (#9) — Add `CREATE INDEX` on `source_id` for all three tables.

7. **`files` as HashMap** (#10) — Change from `serde_json::Value` to `HashMap<String, String>`.

8. **Per-source timeout** (#12) — Add `tokio::time::timeout(Duration::from_millis(500))` around each fs read.

9. **Route path** (#13) — Use `"/api/ontology-sources"` in nest, matching existing pattern.

10. **Update features/mod.rs** (#14) — Add `pub mod ontology_sources;`.

11. **Update properties unique constraint too** (#15) — Add source_id to `(name, class_id)` constraint with same NULL-handling pattern.

12. **Version re-import** (Critical #2) — Use `ON CONFLICT (version) DO UPDATE SET updated_at = NOW()` for re-imports.

## Not Integrated

1. **Manifest files missing on disk** (#6) — They DO exist. `ontology-data/manifest.json` and `multi-perspective-context-ontology/manifest.json` were created earlier in this session. The reviewer may have missed them since they're in separate repos symlinked into `data/`.

2. **`cargo sqlx prepare`** (#11) — Correct but this is a build step, not a plan section. Will be in implementation instructions.

## Clarifications Added to Plan

- Missing `sources.json` → return empty list (not 500)
- `path` column stores the symlink path (not canonical) — allows detecting broken links
- `ontology_sources` is global (no tenant_id) — stated explicitly
