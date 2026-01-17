use super::models::*;
use moka::future::Cache;
use sqlx::{Pool, Postgres};
use std::time::Duration;
use uuid::Uuid;

#[derive(Debug)]
pub enum RebacError {
    DatabaseError(String),
    NotFound(String),
    InvalidInput(String),
    PermissionDenied(String),
}

impl std::fmt::Display for RebacError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            Self::NotFound(msg) => write!(f, "Not found: {}", msg),
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            Self::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
        }
    }
}

impl From<sqlx::Error> for RebacError {
    fn from(err: sqlx::Error) -> Self {
        RebacError::DatabaseError(err.to_string())
    }
}

use super::policy_service::PolicyService;

use crate::features::ontology::OntologyService;

#[derive(Clone)]
pub struct RebacService {
    pub pool: Pool<Postgres>,
    pub ontology_service: OntologyService,
    pub audit_service: crate::features::system::AuditService,
    pub policy_service: PolicyService,
    // Cache for (user_id, entity_id, permission, tenant_id) -> PermissionCheckResult
    pub(crate) permission_cache: Cache<(Uuid, Uuid, String, Option<Uuid>), PermissionCheckResult>,
}

impl RebacService {
    pub fn new(
        pool: Pool<Postgres>,
        ontology_service: OntologyService,
        audit_service: crate::features::system::AuditService,
    ) -> Self {
        let policy_service = PolicyService::new(pool.clone());
        let permission_cache = Cache::builder()
            .max_capacity(10_000)
            .time_to_live(Duration::from_secs(30)) // Short TTL for security
            .build();

        Self {
            pool,
            ontology_service,
            audit_service,
            policy_service,
            permission_cache,
        }
    }
}
