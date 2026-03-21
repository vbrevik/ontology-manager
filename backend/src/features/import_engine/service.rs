use std::collections::HashMap;
use std::path::PathBuf;

use chrono::Utc;
use sqlx::{Pool, Postgres, Row};
use tracing::{info, warn};
use uuid::Uuid;

use super::adapters;
use super::models::{
    ConflictEntry, ImportError, ImportResult, ImportStats, UnloadResult,
};
use crate::features::ontology_sources::models::SourceManifest;

#[derive(Clone)]
pub struct ImportService {
    pool: Pool<Postgres>,
    data_dir: PathBuf,
}

impl ImportService {
    pub fn new(pool: Pool<Postgres>, data_dir: PathBuf) -> Self {
        Self { pool, data_dir }
    }

    pub async fn import_source(
        &self,
        source_id: &str,
        role: &str,
    ) -> Result<ImportResult, ImportError> {
        // Validate role
        if role != "base" && role != "extension" {
            return Err(ImportError::InvalidInput(format!(
                "Invalid role '{}': must be 'base' or 'extension'",
                role
            )));
        }

        // Step 1: Resolve source
        let source = sqlx::query_as::<_, crate::features::ontology_sources::models::OntologySource>(
            "SELECT * FROM ontology_sources WHERE source_id = $1",
        )
        .bind(source_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| ImportError::NotFound(format!("Source '{}' not found", source_id)))?;

        // If extension, verify base exists
        if role == "extension" {
            let base_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM ontology_sources WHERE is_base = TRUE AND imported_at IS NOT NULL)",
            )
            .fetch_one(&self.pool)
            .await?;

            if !base_exists {
                return Err(ImportError::InvalidInput(
                    "No base source imported. Import a base source first.".to_string(),
                ));
            }
        }

        // Read manifest from source directory
        let source_dir = self.data_dir.join(&source.path);
        if !source_dir.exists() {
            return Err(ImportError::NotFound(format!(
                "Source directory not found: {}",
                source_dir.display()
            )));
        }

        let manifest_path = source_dir.join("manifest.json");
        let manifest_content = tokio::fs::read_to_string(&manifest_path).await?;
        let manifest: SourceManifest = serde_json::from_str(&manifest_content)
            .map_err(|e| ImportError::ParseError(format!("Invalid manifest: {}", e)))?;

        // Step 2: Adapt
        let parsed = adapters::parse_source(&source_dir, &manifest).await?;

        // Step 3: Validate and sort
        let parsed = adapters::validate_and_sort(parsed)?;

        info!(
            source_id = source_id,
            role = role,
            classes = parsed.classes.len(),
            properties = parsed.properties.len(),
            relationship_types = parsed.relationship_types.len(),
            "Importing ontology source"
        );

        // Step 4-6: Transaction
        let mut tx = self.pool.begin().await?;

        // Step 4: Clean swap — delete existing data for this source
        sqlx::query("DELETE FROM properties WHERE source_id = $1")
            .bind(source_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM relationship_types WHERE source_id = $1")
            .bind(source_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM classes WHERE source_id = $1")
            .bind(source_id)
            .execute(&mut *tx)
            .await?;

        // Get current ontology version
        let version_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM ontology_versions WHERE is_current = TRUE",
        )
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| {
            ImportError::ImportFailed("No current ontology version found".to_string())
        })?;

        // Insert classes in topological order
        let mut name_to_id: HashMap<String, Uuid> = HashMap::new();
        for class in &parsed.classes {
            let parent_class_id = if let Some(ref parent_name) = class.parent_name {
                match name_to_id.get(parent_name).copied() {
                    Some(id) => Some(id),
                    None => {
                        // Fall back to DB lookup for cross-source parent references
                        sqlx::query_scalar::<_, Uuid>(
                            "SELECT id FROM classes WHERE name = $1 AND version_id = $2 LIMIT 1",
                        )
                        .bind(parent_name)
                        .bind(version_id)
                        .fetch_optional(&mut *tx)
                        .await?
                    }
                }
            } else {
                None
            };

            let id = sqlx::query_scalar::<_, Uuid>(
                r#"INSERT INTO classes (name, description, parent_class_id, version_id, tenant_id, is_abstract, is_system, source_id)
                   VALUES ($1, $2, $3, $4, NULL, $5, $6, $7)
                   RETURNING id"#,
            )
            .bind(&class.name)
            .bind(&class.description)
            .bind(parent_class_id)
            .bind(version_id)
            .bind(class.is_abstract)
            .bind(class.is_system)
            .bind(source_id)
            .fetch_one(&mut *tx)
            .await?;

            name_to_id.insert(class.name.clone(), id);
        }

        // Insert properties
        for prop in &parsed.properties {
            let class_id = name_to_id.get(&prop.class_name).ok_or_else(|| {
                ImportError::ImportFailed(format!(
                    "Class '{}' not found in name map for property '{}'",
                    prop.class_name, prop.name
                ))
            })?;

            sqlx::query(
                r#"INSERT INTO properties (name, description, class_id, data_type, is_required, is_unique, is_sensitive, validation_rules, version_id, source_id, is_indexed, is_deprecated, reference_class_id, default_value)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, FALSE, NULL, NULL)"#,
            )
            .bind(&prop.name)
            .bind(&prop.description)
            .bind(class_id)
            .bind(&prop.data_type)
            .bind(prop.is_required)
            .bind(prop.is_unique)
            .bind(prop.is_sensitive)
            .bind(&prop.validation_rules)
            .bind(version_id)
            .bind(source_id)
            .execute(&mut *tx)
            .await?;
        }

        // Insert relationship types
        for rt in &parsed.relationship_types {
            let source_class_id = resolve_class_id(
                &rt.source_class_name,
                &name_to_id,
                version_id,
                &mut tx,
            )
            .await?;
            let target_class_id = resolve_class_id(
                &rt.target_class_name,
                &name_to_id,
                version_id,
                &mut tx,
            )
            .await?;

            sqlx::query(
                r#"INSERT INTO relationship_types (name, description, source_cardinality, target_cardinality, allowed_source_class_id, allowed_target_class_id, grants_permission_inheritance, source_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
            )
            .bind(&rt.name)
            .bind(&rt.description)
            .bind(&rt.source_cardinality)
            .bind(&rt.target_cardinality)
            .bind(source_class_id)
            .bind(target_class_id)
            .bind(rt.grants_permission_inheritance)
            .bind(source_id)
            .execute(&mut *tx)
            .await?;
        }

        // Step 5: Detect conflicts (extension only)
        let conflicts = if role == "extension" {
            detect_conflicts(&mut tx, source_id).await?
        } else {
            vec![]
        };

        // Step 6: Finalize — update flags
        let (is_base, is_extension) = match role {
            "base" => (true, false),
            "extension" => (false, true),
            _ => unreachable!(),
        };

        // Clear previous holder of this role and clean up their data
        if is_base {
            // Unload previous base source's data
            let prev_base = sqlx::query_scalar::<_, String>(
                "SELECT source_id FROM ontology_sources WHERE is_base = TRUE AND source_id != $1",
            )
            .bind(source_id)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(ref prev_id) = prev_base {
                sqlx::query("DELETE FROM properties WHERE source_id = $1")
                    .bind(prev_id)
                    .execute(&mut *tx)
                    .await?;
                sqlx::query("DELETE FROM relationship_types WHERE source_id = $1")
                    .bind(prev_id)
                    .execute(&mut *tx)
                    .await?;
                sqlx::query("DELETE FROM classes WHERE source_id = $1")
                    .bind(prev_id)
                    .execute(&mut *tx)
                    .await?;
            }
            sqlx::query("UPDATE ontology_sources SET is_base = FALSE WHERE is_base = TRUE")
                .execute(&mut *tx)
                .await?;
        }
        if is_extension {
            // Unload previous extension source's data
            let prev_ext = sqlx::query_scalar::<_, String>(
                "SELECT source_id FROM ontology_sources WHERE is_extension = TRUE AND source_id != $1",
            )
            .bind(source_id)
            .fetch_optional(&mut *tx)
            .await?;

            if let Some(ref prev_id) = prev_ext {
                sqlx::query("DELETE FROM properties WHERE source_id = $1")
                    .bind(prev_id)
                    .execute(&mut *tx)
                    .await?;
                sqlx::query("DELETE FROM relationship_types WHERE source_id = $1")
                    .bind(prev_id)
                    .execute(&mut *tx)
                    .await?;
                sqlx::query("DELETE FROM classes WHERE source_id = $1")
                    .bind(prev_id)
                    .execute(&mut *tx)
                    .await?;
                sqlx::query("DELETE FROM source_conflicts WHERE extension_source_id = $1")
                    .bind(prev_id)
                    .execute(&mut *tx)
                    .await?;
            }
            sqlx::query("UPDATE ontology_sources SET is_extension = FALSE WHERE is_extension = TRUE")
                .execute(&mut *tx)
                .await?;
        }

        // Set flags on this source
        let imported_at = sqlx::query_scalar::<_, chrono::DateTime<Utc>>(
            "UPDATE ontology_sources SET is_base = $1, is_extension = $2, imported_at = NOW() WHERE source_id = $3 RETURNING imported_at",
        )
        .bind(is_base)
        .bind(is_extension)
        .bind(source_id)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;

        let stats = ImportStats {
            classes: parsed.classes.len(),
            properties: parsed.properties.len(),
            relationship_types: parsed.relationship_types.len(),
        };

        info!(
            source_id = source_id,
            role = role,
            classes = stats.classes,
            properties = stats.properties,
            relationship_types = stats.relationship_types,
            conflicts = conflicts.len(),
            "Import complete"
        );

        Ok(ImportResult {
            source_id: source_id.to_string(),
            role: role.to_string(),
            imported: stats,
            conflicts,
            imported_at,
        })
    }

    pub async fn unload_source(&self, source_id: &str) -> Result<UnloadResult, ImportError> {
        // Verify source exists
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM ontology_sources WHERE source_id = $1)",
        )
        .bind(source_id)
        .fetch_one(&self.pool)
        .await?;

        if !exists {
            return Err(ImportError::NotFound(format!(
                "Source '{}' not found",
                source_id
            )));
        }

        let mut tx = self.pool.begin().await?;

        // Delete data in FK-safe order
        let props_deleted = sqlx::query("DELETE FROM properties WHERE source_id = $1")
            .bind(source_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();

        let rels_deleted = sqlx::query("DELETE FROM relationship_types WHERE source_id = $1")
            .bind(source_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();

        let classes_deleted = sqlx::query("DELETE FROM classes WHERE source_id = $1")
            .bind(source_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();

        // Clear conflicts
        sqlx::query(
            "DELETE FROM source_conflicts WHERE base_source_id = $1 OR extension_source_id = $1",
        )
        .bind(source_id)
        .execute(&mut *tx)
        .await?;

        // Clear flags
        sqlx::query(
            "UPDATE ontology_sources SET is_base = FALSE, is_extension = FALSE, imported_at = NULL WHERE source_id = $1",
        )
        .bind(source_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        info!(
            source_id = source_id,
            classes = classes_deleted,
            properties = props_deleted,
            relationship_types = rels_deleted,
            "Unloaded source"
        );

        Ok(UnloadResult {
            source_id: source_id.to_string(),
            removed: ImportStats {
                classes: classes_deleted as usize,
                properties: props_deleted as usize,
                relationship_types: rels_deleted as usize,
            },
        })
    }
}

/// Resolve a class name to its UUID, checking local map first, then DB.
async fn resolve_class_id(
    class_name: &Option<String>,
    name_to_id: &HashMap<String, Uuid>,
    version_id: Uuid,
    tx: &mut sqlx::Transaction<'_, Postgres>,
) -> Result<Option<Uuid>, ImportError> {
    match class_name {
        Some(name) => match name_to_id.get(name).copied() {
            Some(id) => Ok(Some(id)),
            None => {
                let id = sqlx::query_scalar::<_, Uuid>(
                    "SELECT id FROM classes WHERE name = $1 AND version_id = $2 LIMIT 1",
                )
                .bind(name)
                .bind(version_id)
                .fetch_optional(&mut **tx)
                .await?;
                Ok(id)
            }
        },
        None => Ok(None),
    }
}

/// Detect conflicts between an extension source and the current base source.
async fn detect_conflicts(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    extension_source_id: &str,
) -> Result<Vec<ConflictEntry>, ImportError> {
    // Find the base source
    let base_source_id = sqlx::query_scalar::<_, String>(
        "SELECT source_id FROM ontology_sources WHERE is_base = TRUE AND imported_at IS NOT NULL",
    )
    .fetch_optional(&mut **tx)
    .await?;

    let base_source_id = match base_source_id {
        Some(id) => id,
        None => return Ok(vec![]), // No base, no conflicts
    };

    // Clear old conflicts for this pair
    sqlx::query(
        "DELETE FROM source_conflicts WHERE base_source_id = $1 AND extension_source_id = $2",
    )
    .bind(&base_source_id)
    .bind(extension_source_id)
    .execute(&mut **tx)
    .await?;

    let mut conflicts = Vec::new();

    // Detect class conflicts
    let class_conflicts = sqlx::query(
        r#"SELECT c1.name FROM classes c1
           JOIN classes c2 ON c1.name = c2.name
           WHERE c1.source_id = $1 AND c2.source_id = $2"#,
    )
    .bind(extension_source_id)
    .bind(&base_source_id)
    .fetch_all(&mut **tx)
    .await?;

    for row in &class_conflicts {
        let name: String = row.get("name");
        conflicts.push(ConflictEntry {
            entity_type: "class".to_string(),
            name: name.clone(),
            base_source: base_source_id.clone(),
            extension_source: extension_source_id.to_string(),
        });
    }

    // Detect property conflicts
    let prop_conflicts = sqlx::query(
        r#"SELECT p1.name, c1.name as class_name FROM properties p1
           JOIN classes c1 ON p1.class_id = c1.id
           JOIN properties p2 ON p1.name = p2.name
           JOIN classes c2 ON p2.class_id = c2.id
           WHERE c1.name = c2.name AND p1.source_id = $1 AND p2.source_id = $2"#,
    )
    .bind(extension_source_id)
    .bind(&base_source_id)
    .fetch_all(&mut **tx)
    .await?;

    for row in &prop_conflicts {
        let name: String = row.get("name");
        conflicts.push(ConflictEntry {
            entity_type: "property".to_string(),
            name,
            base_source: base_source_id.clone(),
            extension_source: extension_source_id.to_string(),
        });
    }

    // Detect relationship type conflicts
    let rt_conflicts = sqlx::query(
        r#"SELECT r1.name FROM relationship_types r1
           JOIN relationship_types r2 ON r1.name = r2.name
           WHERE r1.source_id = $1 AND r2.source_id = $2"#,
    )
    .bind(extension_source_id)
    .bind(&base_source_id)
    .fetch_all(&mut **tx)
    .await?;

    for row in &rt_conflicts {
        let name: String = row.get("name");
        conflicts.push(ConflictEntry {
            entity_type: "relationship_type".to_string(),
            name,
            base_source: base_source_id.clone(),
            extension_source: extension_source_id.to_string(),
        });
    }

    // Insert conflicts into source_conflicts table
    for conflict in &conflicts {
        sqlx::query(
            r#"INSERT INTO source_conflicts (base_source_id, extension_source_id, entity_type, entity_name)
               VALUES ($1, $2, $3, $4)"#,
        )
        .bind(&conflict.base_source)
        .bind(&conflict.extension_source)
        .bind(&conflict.entity_type)
        .bind(&conflict.name)
        .execute(&mut **tx)
        .await?;
    }

    if !conflicts.is_empty() {
        warn!(
            base = base_source_id,
            extension = extension_source_id,
            count = conflicts.len(),
            "Conflicts detected between base and extension"
        );
    }

    Ok(conflicts)
}
