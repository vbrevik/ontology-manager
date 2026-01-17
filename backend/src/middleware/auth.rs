use crate::config::Config;
use crate::features::auth::jwt::validate_jwt;
use axum::http::header::AUTHORIZATION;
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub roles: Vec<crate::features::auth::jwt::UserRoleClaim>,
}

#[allow(dead_code)]
pub struct AuthMiddleware;

#[async_trait]
impl<S> FromRequestParts<S> for AuthMiddleware
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Try to get token from authorization header first
        let token = if let Some(auth_header) = parts.headers.get(AUTHORIZATION) {
            auth_header
                .to_str()
                .map_err(|_| AuthError::InvalidToken)?
                .strip_prefix("Bearer ")
                .ok_or(AuthError::InvalidToken)?
                .to_string()
        } else {
            // Fallback to cookie
            let cookies = parts
                .extensions
                .get::<tower_cookies::Cookies>()
                .ok_or(AuthError::MissingConfig)?;
            cookies
                .get("access_token")
                .map(|c| c.value().to_string())
                .ok_or(AuthError::MissingToken)?
        };

        // Get config from extensions
        let config = parts
            .extensions
            .get::<Arc<Config>>()
            .ok_or(AuthError::MissingConfig)?
            .clone();

        // Validate token
        let claims = validate_jwt(&token, &config).map_err(|_| AuthError::InvalidToken)?;

        // Store claims in extensions for later use
        parts.extensions.insert(claims);

        Ok(AuthMiddleware)
    }
}

pub async fn auth_middleware(
    req: axum::extract::Request,
    next: axum::middleware::Next,
) -> Result<Response, AuthError> {
    let (mut parts, body) = req.into_parts();

    // We use the extractor logic here
    let token = if let Some(auth_header) = parts.headers.get(AUTHORIZATION) {
        auth_header
            .to_str()
            .map_err(|_| AuthError::InvalidToken)?
            .strip_prefix("Bearer ")
            .ok_or(AuthError::InvalidToken)?
            .to_string()
    } else {
        // Fallback to cookie
        let cookies = parts
            .extensions
            .get::<tower_cookies::Cookies>()
            .ok_or(AuthError::MissingConfig)?;
        cookies
            .get("access_token")
            .map(|c| c.value().to_string())
            .ok_or(AuthError::MissingToken)?
    };

    // Get config from extensions
    let config = parts
        .extensions
        .get::<Arc<Config>>()
        .ok_or(AuthError::MissingConfig)?
        .clone();

    // Validate token
    let claims = validate_jwt(&token, &config).map_err(|_| AuthError::InvalidToken)?;

    // Store claims in extensions for later use
    parts.extensions.insert(claims);

    // Reconstruct request
    let req = axum::extract::Request::from_parts(parts, body);
    Ok(next.run(req).await)
}

#[allow(dead_code)]
#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
    UserNotFound,
    MissingConfig,
}

impl serde::Serialize for AuthError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let message = match self {
            AuthError::MissingToken => "Missing authorization token",
            AuthError::InvalidToken => "Invalid authorization token",
            AuthError::MissingConfig => "Server configuration error",
            AuthError::UserNotFound => "User not found",
        };
        serializer.serialize_str(message)
    }
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Missing authorization token"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid authorization token"),
            AuthError::UserNotFound => (StatusCode::NOT_FOUND, "User not found"),
            AuthError::MissingConfig => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Server configuration error",
            ),
        };

        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}

// Extract user from request extensions
pub fn get_user_from_request(parts: &Parts) -> Result<User, AuthError> {
    let claims = parts
        .extensions
        .get::<crate::features::auth::jwt::Claims>()
        .ok_or(AuthError::MissingConfig)?
        .clone();

    Ok(User {
        id: claims.sub,
        username: claims.username,
        email: claims.email,
        roles: claims.roles,
    })
}

// Require authentication middleware
pub fn require_auth() -> AuthMiddleware {
    AuthMiddleware
}
