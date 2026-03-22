use super::models::*;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use sqlx::{Pool, Postgres};
use std::path::PathBuf;
use std::time::Duration;
use tracing::{info, warn};

#[derive(Debug, thiserror::Error)]
pub enum SourceError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl SourceError {
    pub fn to_status_code(&self) -> StatusCode {
        match self {
            Self::IoError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::ParseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::DatabaseError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::InvalidInput(_) => StatusCode::BAD_REQUEST,
        }
    }
}

impl IntoResponse for SourceError {
    fn into_response(self) -> Response {
        let status = self.to_status_code();
        let body = serde_json::json!({
            "error": self.to_string(),
        });
        (status, Json(body)).into_response()
    }
}

/// Internal struct for discovered source data before DB enrichment.
#[derive(Debug, Clone)]
pub struct DiscoveredSource {
    pub source_id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub format: String,
    pub domain: Option<String>,
    pub path: String,
    pub stats: Option<serde_json::Value>,
    pub available: bool,
}

#[derive(Clone)]
pub struct OntologySourceService {
    pool: Pool<Postgres>,
    data_dir: PathBuf,
}

impl OntologySourceService {
    pub fn new(pool: Pool<Postgres>, data_dir: PathBuf) -> Self {
        Self { pool, data_dir }
    }

    /// Discover sources from the filesystem without DB interaction.
    /// This is the core filesystem logic, shared between discover_sources and tests.
    pub async fn discover_from_filesystem(
        data_dir: &std::path::Path,
    ) -> Result<Vec<DiscoveredSource>, SourceError> {
        let sources_path = data_dir.join("sources.json");

        let content = match tokio::fs::read_to_string(&sources_path).await {
            Ok(c) => c,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Ok(vec![]);
            }
            Err(e) => return Err(SourceError::IoError(e)),
        };

        let config: SourcesConfig = serde_json::from_str(&content)
            .map_err(|e| SourceError::ParseError(e.to_string()))?;

        let active_entries: Vec<_> = config.sources.into_iter().filter(|s| s.active).collect();

        let mut discovered = Vec::new();

        for entry in &active_entries {
            let source_path = data_dir.join(&entry.path);
            let source_path_str = source_path.to_string_lossy().to_string();

            // Check directory existence via symlink_metadata (detects symlinks themselves)
            let exists = tokio::fs::symlink_metadata(&source_path).await.is_ok();

            if !exists {
                discovered.push(DiscoveredSource {
                    source_id: entry.id.clone(),
                    name: entry.id.clone(),
                    description: Some(entry.description.clone()),
                    version: None,
                    format: "unknown".to_string(),
                    domain: None,
                    path: source_path_str,
                    stats: None,
                    available: false,
                });
                continue;
            }

            // Check symlink target validity
            let available = match tokio::fs::read_link(&source_path).await {
                Ok(target) => {
                    // It's a symlink — check if target exists
                    let abs_target = if target.is_absolute() {
                        target
                    } else {
                        source_path.parent().unwrap_or(data_dir).join(&target)
                    };
                    tokio::fs::symlink_metadata(&abs_target).await.is_ok()
                }
                Err(_) => {
                    // Not a symlink — regular dir, available
                    true
                }
            };

            if !available {
                warn!(source_id = %entry.id, "Broken symlink detected");
                discovered.push(DiscoveredSource {
                    source_id: entry.id.clone(),
                    name: entry.id.clone(),
                    description: Some(entry.description.clone()),
                    version: None,
                    format: "unknown".to_string(),
                    domain: None,
                    path: source_path_str,
                    stats: None,
                    available: false,
                });
                continue;
            }

            // Try to read manifest.json with timeout
            let manifest_path = source_path.join("manifest.json");
            let manifest = match tokio::time::timeout(
                Duration::from_millis(500),
                tokio::fs::read_to_string(&manifest_path),
            )
            .await
            {
                Ok(Ok(content)) => {
                    match serde_json::from_str::<SourceManifest>(&content) {
                        Ok(m) => Some(m),
                        Err(e) => {
                            warn!(source_id = %entry.id, error = %e, "Failed to parse manifest.json");
                            None
                        }
                    }
                }
                Ok(Err(_)) => None,
                Err(_) => {
                    warn!(source_id = %entry.id, "Timeout reading manifest.json");
                    discovered.push(DiscoveredSource {
                        source_id: entry.id.clone(),
                        name: entry.id.clone(),
                        description: Some(entry.description.clone()),
                        version: None,
                        format: "unknown".to_string(),
                        domain: None,
                        path: source_path_str,
                        stats: None,
                        available: false,
                    });
                    continue;
                }
            };

            let (name, description, version, format, domain, stats) = match &manifest {
                Some(m) => (
                    m.name.clone(),
                    Some(m.description.clone()),
                    Some(m.version.clone()),
                    m.format.clone(),
                    m.domain.clone(),
                    m.stats.clone(),
                ),
                None => (
                    entry.id.clone(),
                    Some(entry.description.clone()),
                    None,
                    "unknown".to_string(),
                    None,
                    None,
                ),
            };

            discovered.push(DiscoveredSource {
                source_id: entry.id.clone(),
                name,
                description,
                version,
                format,
                domain,
                path: source_path_str,
                stats,
                available: true,
            });
        }

        Ok(discovered)
    }

    pub async fn discover_sources(&self) -> Result<Vec<SourceResponse>, SourceError> {
        let discovered = Self::discover_from_filesystem(&self.data_dir).await?;

        // Sync to DB
        self.sync_sources_to_db(&discovered).await?;

        // Batch fetch DB status for all discovered sources
        let source_ids: Vec<&str> = discovered.iter().map(|s| s.source_id.as_str()).collect();
        let db_sources = sqlx::query_as::<_, OntologySource>(
            "SELECT * FROM ontology_sources WHERE source_id = ANY($1)",
        )
        .bind(&source_ids)
        .fetch_all(&self.pool)
        .await?;

        let responses: Vec<SourceResponse> = discovered
            .iter()
            .map(|src| {
                let db = db_sources.iter().find(|d| d.source_id == src.source_id);
                SourceResponse {
                    id: src.source_id.clone(),
                    name: src.name.clone(),
                    description: src.description.clone(),
                    version: src.version.clone(),
                    format: src.format.clone(),
                    domain: src.domain.clone(),
                    available: src.available,
                    imported_at: db.and_then(|s| s.imported_at),
                    is_base: db.map_or(false, |s| s.is_base),
                    is_extension: db.map_or(false, |s| s.is_extension),
                    stats: src.stats.clone(),
                }
            })
            .collect();

        info!(count = responses.len(), "Discovered ontology sources");
        Ok(responses)
    }

    pub async fn get_active_sources(&self) -> Result<ActiveSourcesResponse, SourceError> {
        let rows = sqlx::query_as::<_, OntologySource>(
            "SELECT * FROM ontology_sources WHERE is_base = TRUE OR is_extension = TRUE",
        )
        .fetch_all(&self.pool)
        .await?;

        let base = rows.iter().find(|r| r.is_base).map(|r| SourceResponse {
            id: r.source_id.clone(),
            name: r.name.clone(),
            description: r.description.clone(),
            version: r.version.clone(),
            format: r.format.clone(),
            domain: r.domain.clone(),
            available: true,
            imported_at: r.imported_at,
            is_base: true,
            is_extension: false,
            stats: r.stats.clone(),
        });

        let extension = rows.iter().find(|r| r.is_extension).map(|r| SourceResponse {
            id: r.source_id.clone(),
            name: r.name.clone(),
            description: r.description.clone(),
            version: r.version.clone(),
            format: r.format.clone(),
            domain: r.domain.clone(),
            available: true,
            imported_at: r.imported_at,
            is_base: false,
            is_extension: true,
            stats: r.stats.clone(),
        });

        Ok(ActiveSourcesResponse { base, extension })
    }

    pub async fn set_active_sources(
        &self,
        input: SetActiveInput,
    ) -> Result<ActiveSourcesResponse, SourceError> {
        // Validate same source is not both base and extension
        if let (Some(ref base_id), Some(ref ext_id)) = (&input.base, &input.extension) {
            if base_id == ext_id {
                return Err(SourceError::InvalidInput(
                    "The same source cannot be both base and extension".to_string(),
                ));
            }
        }

        let mut tx = self.pool.begin().await?;

        // Clear all base flags
        sqlx::query("UPDATE ontology_sources SET is_base = FALSE WHERE is_base = TRUE")
            .execute(&mut *tx)
            .await?;

        // Clear all extension flags
        sqlx::query("UPDATE ontology_sources SET is_extension = FALSE WHERE is_extension = TRUE")
            .execute(&mut *tx)
            .await?;

        // Set new base
        if let Some(ref base_id) = input.base {
            let result = sqlx::query(
                "UPDATE ontology_sources SET is_base = TRUE WHERE source_id = $1",
            )
            .bind(base_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() == 0 {
                return Err(SourceError::NotFound(format!(
                    "Source '{}' not found",
                    base_id
                )));
            }
        }

        // Set new extension
        if let Some(ref ext_id) = input.extension {
            let result = sqlx::query(
                "UPDATE ontology_sources SET is_extension = TRUE WHERE source_id = $1",
            )
            .bind(ext_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() == 0 {
                return Err(SourceError::NotFound(format!(
                    "Source '{}' not found",
                    ext_id
                )));
            }
        }

        tx.commit().await?;

        self.get_active_sources().await
    }

    pub async fn sync_sources_to_db(
        &self,
        sources: &[DiscoveredSource],
    ) -> Result<(), SourceError> {
        for src in sources {
            sqlx::query(
                r#"INSERT INTO ontology_sources (source_id, name, description, version, format, domain, path, stats)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                   ON CONFLICT (source_id) DO UPDATE SET
                       name = EXCLUDED.name,
                       description = EXCLUDED.description,
                       version = EXCLUDED.version,
                       format = EXCLUDED.format,
                       domain = EXCLUDED.domain,
                       path = EXCLUDED.path,
                       stats = EXCLUDED.stats,
                       updated_at = NOW()"#,
            )
            .bind(&src.source_id)
            .bind(&src.name)
            .bind(&src.description)
            .bind(&src.version)
            .bind(&src.format)
            .bind(&src.domain)
            .bind(&src.path)
            .bind(&src.stats)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// Helper to create a sources.json in a temp dir
    fn write_sources_json(dir: &std::path::Path, content: &str) {
        fs::write(dir.join("sources.json"), content).unwrap();
    }

    /// Helper to create a source directory with manifest.json
    fn create_source_with_manifest(
        dir: &std::path::Path,
        source_path: &str,
        manifest: &str,
    ) {
        let source_dir = dir.join(source_path);
        fs::create_dir_all(&source_dir).unwrap();
        fs::write(source_dir.join("manifest.json"), manifest).unwrap();
    }

    #[tokio::test]
    async fn test_discover_valid_sources() {
        let dir = TempDir::new().unwrap();

        write_sources_json(dir.path(), r#"{
            "description": "Test sources",
            "sources": [
                {"id": "src-1", "path": "./src-1", "description": "Source 1", "active": true},
                {"id": "src-2", "path": "./src-2", "description": "Source 2", "active": true}
            ]
        }"#);

        create_source_with_manifest(dir.path(), "src-1", r#"{
            "name": "Source One", "version": "1.0.0", "description": "First source",
            "type": "ontology-data-source", "format": "json",
            "files": {"classes": "classes.json"}
        }"#);

        create_source_with_manifest(dir.path(), "src-2", r#"{
            "name": "Source Two", "version": "2.0.0", "description": "Second source",
            "type": "ontology-data-source", "format": "json-schema", "domain": "military",
            "files": {"classes": "classes.json"}, "stats": {"classes": 42}
        }"#);

        let result = OntologySourceService::discover_from_filesystem(dir.path()).await.unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|s| s.available));
        assert_eq!(result[0].name, "Source One");
        assert_eq!(result[0].version, Some("1.0.0".to_string()));
        assert_eq!(result[1].name, "Source Two");
        assert_eq!(result[1].format, "json-schema");
    }

    #[tokio::test]
    async fn test_discover_broken_symlink() {
        let dir = TempDir::new().unwrap();

        write_sources_json(dir.path(), r#"{
            "description": "Test",
            "sources": [
                {"id": "broken", "path": "./nonexistent-target", "description": "Broken", "active": true}
            ]
        }"#);

        // Don't create the directory — simulates broken symlink / missing path
        let result = OntologySourceService::discover_from_filesystem(dir.path()).await.unwrap();
        assert_eq!(result.len(), 1);
        assert!(!result[0].available);
    }

    #[tokio::test]
    async fn test_discover_missing_manifest() {
        let dir = TempDir::new().unwrap();

        write_sources_json(dir.path(), r#"{
            "description": "Test",
            "sources": [
                {"id": "no-manifest", "path": "./no-manifest", "description": "No manifest", "active": true}
            ]
        }"#);

        // Create directory but no manifest.json
        fs::create_dir(dir.path().join("no-manifest")).unwrap();

        let result = OntologySourceService::discover_from_filesystem(dir.path()).await.unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].available);
        // Falls back to entry id as name
        assert_eq!(result[0].name, "no-manifest");
        assert_eq!(result[0].version, None);
    }

    #[tokio::test]
    async fn test_discover_missing_sources_json() {
        let dir = TempDir::new().unwrap();
        // Empty dir — no sources.json
        let result = OntologySourceService::discover_from_filesystem(dir.path()).await.unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn test_discover_inactive_source_excluded() {
        let dir = TempDir::new().unwrap();

        write_sources_json(dir.path(), r#"{
            "description": "Test",
            "sources": [
                {"id": "active-src", "path": "./active", "description": "Active", "active": true},
                {"id": "inactive-src", "path": "./inactive", "description": "Inactive", "active": false}
            ]
        }"#);

        create_source_with_manifest(dir.path(), "active", r#"{
            "name": "Active", "version": "1.0.0", "description": "Active source",
            "type": "ontology-data-source", "format": "json",
            "files": {"classes": "c.json"}
        }"#);

        create_source_with_manifest(dir.path(), "inactive", r#"{
            "name": "Inactive", "version": "1.0.0", "description": "Inactive source",
            "type": "ontology-data-source", "format": "json",
            "files": {"classes": "c.json"}
        }"#);

        let result = OntologySourceService::discover_from_filesystem(dir.path()).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].source_id, "active-src");
    }
}
