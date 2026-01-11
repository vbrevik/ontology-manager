use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use crate::features::abac::AbacService;
use crate::features::auth::jwt::Claims;
use uuid::Uuid;

/// Extractor that requires a specific permission for access
/// 
/// Usage:
/// ```rust
/// async fn delete_project(
///     RequirePermission(user, _): RequirePermission,
///     Path(project_id): Path<String>,
/// ) -> impl IntoResponse { ... }
/// ```
pub struct RequirePermission {
    pub claims: Claims,
}

/// Error type for permission check failures
#[derive(Debug)]
pub enum PermissionError {
    Unauthorized,
    Forbidden(String),
    InternalError(String),
}

impl IntoResponse for PermissionError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            PermissionError::Unauthorized => (StatusCode::UNAUTHORIZED, "Authentication required"),
            PermissionError::Forbidden(msg) => (StatusCode::FORBIDDEN, {
                // We need to return a static str, so we'll use a generic message
                // The actual message is logged server-side
                tracing::warn!("Permission denied: {}", msg);
                "You do not have permission to perform this action"
            }),
            PermissionError::InternalError(msg) => {
                tracing::error!("ABAC internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Authorization check failed")
            }
        };
        
        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}

/// Check if user has a specific permission, optionally scoped to a resource
pub async fn check_user_permission(
    abac_service: &AbacService,
    user_id: &str,
    action: &str,
    resource_id: Option<&str>,
    tenant_id: Option<Uuid>,
    field_name: Option<&str>,
) -> Result<bool, PermissionError> {
    abac_service
        .check_permission(user_id, action, resource_id, tenant_id, field_name)
        .await
        .map_err(|e| PermissionError::InternalError(e.to_string()))
}

/// Middleware function to require a specific permission
/// 
/// Use with axum's `from_fn_with_state` for route-level permission checks
pub async fn require_permission<B>(
    State(abac_service): State<AbacService>,
    claims: Option<Claims>,
    action: &'static str,
    resource_id: Option<String>,
    tenant_id: Option<Uuid>,
    field_name: Option<String>,
) -> Result<(), PermissionError> {
    let claims = claims.ok_or(PermissionError::Unauthorized)?;
    
    let has_permission = check_user_permission(
        &abac_service,
        &claims.sub,
        action,
        resource_id.as_deref(),
        tenant_id,
        field_name.as_deref(),
    )
    .await?;
    
    if has_permission {
        Ok(())
    } else {
        Err(PermissionError::Forbidden(format!(
            "User {} lacks permission '{}' for resource {:?} (field: {:?}, tenant: {:?})",
            claims.sub, action, resource_id, field_name, tenant_id
        )))
    }
}
