use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    middleware::from_fn,
    Extension, Router,
};
use sqlx::PgPool;
use std::sync::Arc;
use template_repo_backend::middleware::auth::auth_middleware;
use tower::util::ServiceExt; // for `oneshot`

mod common;

// Helper to create the app router for testing
async fn create_test_app(pool: PgPool) -> Router {
    let services = common::setup_services(pool).await;
    // We need to construct the router similar to main.rs
    // For simplicity, we just mount the public auth routes for now,
    // or ideally proper app construction.
    // Let's rely on `features::auth::routes::public_auth_routes`
    // and `protected_auth_routes`.

    let public_routes = template_repo_backend::features::auth::routes::public_auth_routes()
        .with_state(services.auth_service.clone());

    let protected_routes = template_repo_backend::features::auth::routes::protected_auth_routes()
        .with_state(services.auth_service.clone())
        .layer(from_fn(auth_middleware));

    let config = common::create_test_config();
    let config_arc = Arc::new(config);

    use tower_cookies::CookieManagerLayer;
    Router::new()
        .nest(
            "/auth",
            Router::new().merge(public_routes).merge(protected_routes),
        )
        .layer(CookieManagerLayer::new())
        .layer(Extension(config_arc))
}

#[sqlx::test]
async fn test_api_register_success(pool: PgPool) {
    let app = create_test_app(pool).await;

    let payload = serde_json::json!({
        "username": "api_user",
        "email": "api@example.com",
        "password": "ApiPassword123!"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let (parts, body) = response.into_parts();
    let status = parts.status;
    if status != StatusCode::OK {
        let body_bytes = to_bytes(body, usize::MAX).await.unwrap();
        println!("Error Body: {}", String::from_utf8_lossy(&body_bytes));
    }
    assert_eq!(status, StatusCode::OK);

    // Check for Set-Cookie header
    let cookies = parts.headers.get_all("set-cookie");
    let mut has_access = false;
    let mut has_refresh = false;
    for cookie in cookies {
        let s = cookie.to_str().unwrap();
        if s.contains("access_token") {
            has_access = true;
        }
        if s.contains("refresh_token") {
            has_refresh = true;
        }
    }
    assert!(has_access, "Should set access_token cookie");
    assert!(has_refresh, "Should set refresh_token cookie");
}

#[sqlx::test]
async fn test_api_register_invalid_input(pool: PgPool) {
    let app = create_test_app(pool).await;

    // Missing password
    let payload = serde_json::json!({
        "username": "bad_user",
        "email": "bad@example"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Depending on validation, usually 400 or 422.
    // RegisterUser struct doesn't have `validate` derived unless implementation added it.
    // Let's check `auth/routes.rs` -> it calls `user.validate()`.
    // Assuming `UnprocessableEntity` (422) or `BadRequest` (400).
    // The service returns `AuthError::ValidationError` maps to `BadRequest`.
    // Axum Json rejection is 400 or 422.
    // Let's assert it is NOT 200.
    assert_ne!(response.status(), StatusCode::OK);
}

#[sqlx::test]
async fn test_api_login_flow(pool: PgPool) {
    let app = create_test_app(pool.clone()).await;

    // 1. Register first (setup)
    let reg_payload = serde_json::json!({
        "username": "login_api",
        "email": "login@example.com",
        "password": "Password123!"
    });
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(reg_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // 2. Login - Success
    let login_payload = serde_json::json!({
        "identifier": "login@example.com",
        "password": "Password123!"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let (parts, body) = response.into_parts();
    let status = parts.status;
    if status != StatusCode::OK {
        let body_bytes = to_bytes(body, usize::MAX).await.unwrap();
        println!("Error Body: {}", String::from_utf8_lossy(&body_bytes));
    }
    assert_eq!(status, StatusCode::OK);

    // 3. Login - Fail
    let fail_payload = serde_json::json!({
        "identifier": "login@example.com",
        "password": "WrongPassword"
    });

    let response_fail = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(fail_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response_fail.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn test_api_refresh_success(pool: PgPool) {
    let app = create_test_app(pool.clone()).await;

    // 1. Register & Login to get Refresh Token
    let reg_payload = serde_json::json!({
        "username": "refresh_user",
        "email": "refresh@example.com",
        "password": "Password123!"
    });
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(reg_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let login_payload = serde_json::json!({
        "identifier": "refresh@example.com",
        "password": "Password123!"
    });
    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let (parts, _) = login_res.into_parts();
    let cookies = parts.headers.get_all("set-cookie");
    let mut refresh_cookie = String::new();
    for c in cookies {
        let s = c.to_str().unwrap();
        if s.contains("refresh_token") {
            let parts: Vec<&str> = s.split(';').collect();
            refresh_cookie = parts[0].to_string();
        }
    }
    assert!(
        !refresh_cookie.is_empty(),
        "Login should return refresh token"
    );

    // 2. Call Refresh
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/refresh")
                .header("cookie", refresh_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let (parts, body) = response.into_parts();
    let status = parts.status;
    if status != StatusCode::OK {
        let body_bytes = to_bytes(body, usize::MAX).await.unwrap();
        println!("Refresh Error: {}", String::from_utf8_lossy(&body_bytes));
    }
    assert_eq!(status, StatusCode::OK);

    // valid new cookies?
    let new_cookies = parts.headers.get_all("set-cookie");
    let mut has_new_access = false;
    for c in new_cookies {
        if c.to_str().unwrap().contains("access_token") {
            has_new_access = true;
        }
    }
    assert!(has_new_access, "Refresh should issue new access token");
}

#[sqlx::test]
async fn test_api_logout_success(pool: PgPool) {
    let app = create_test_app(pool.clone()).await;

    // 1. Login setup
    let reg_payload = serde_json::json!({
        "username": "logout_user",
        "email": "logout@example.com",
        "password": "Password123!"
    });
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(reg_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let login_payload = serde_json::json!({
        "identifier": "logout@example.com",
        "password": "Password123!"
    });
    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let (parts, _) = login_res.into_parts();
    let cookies_headers = parts.headers.get_all("set-cookie");
    let mut request_cookies = String::new();
    for c in cookies_headers {
        let s = c.to_str().unwrap();
        let parts: Vec<&str> = s.split(';').collect();
        if !request_cookies.is_empty() {
            request_cookies.push_str("; ");
        }
        request_cookies.push_str(parts[0]);
    }

    // 2. Logout
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/logout")
                .header("cookie", request_cookies)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // Verify cookies cleared
    let cleared_cookies = response.headers().get_all("set-cookie");
    let mut access_cleared = false;
    for c in cleared_cookies {
        let s = c.to_str().unwrap();
        if s.contains("access_token") && (s.contains("Max-Age=0") || s.contains("access_token=;")) {
            access_cleared = true;
        }
    }
    assert!(access_cleared, "Logout should clear access_token");
}

#[sqlx::test]
async fn test_api_change_password_flow(pool: PgPool) {
    let app = create_test_app(pool.clone()).await;

    // 1. Register
    let reg_payload = serde_json::json!({
        "username": "chgpwd_user",
        "email": "chgpwd@example.com",
        "password": "OldPassword123!"
    });
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(reg_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // 2. Login
    let login_payload = serde_json::json!({
        "identifier": "chgpwd@example.com",
        "password": "OldPassword123!"
    });
    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Extract cookies for auth
    let (parts, _) = login_res.into_parts();
    let cookies_vec = parts.headers.get_all("set-cookie");
    let mut cookie_header = String::new();
    for c in cookies_vec {
        let s = c.to_str().unwrap();
        let p: Vec<&str> = s.split(';').collect();
        if !cookie_header.is_empty() {
            cookie_header.push_str("; ");
        }
        cookie_header.push_str(p[0]);
    }

    // 3. Change Password
    let change_payload = serde_json::json!({
        "email": "chgpwd@example.com",
        "current_password": "OldPassword123!",
        "new_password": "NewPassword123!"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/change-password")
                .header("content-type", "application/json")
                .header("cookie", cookie_header)
                .body(Body::from(change_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let (parts, body) = response.into_parts();
    if parts.status != StatusCode::OK {
        let b = to_bytes(body, usize::MAX).await.unwrap();
        println!("Change Pwd Error: {}", String::from_utf8_lossy(&b));
    }
    assert_eq!(parts.status, StatusCode::OK);

    // 4. Verification: Login with OLD password (should fail)
    let fail_payload = serde_json::json!({
        "identifier": "chgpwd@example.com",
        "password": "OldPassword123!"
    });
    let fail_res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(fail_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(fail_res.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn test_api_notifications(pool: PgPool) {
    let app = create_test_app(pool.clone()).await;

    // 1. Setup: Register & Login
    let reg_payload = serde_json::json!({
        "username": "notif_user",
        "email": "notif@example.com",
        "password": "Password123!"
    });
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(reg_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let login_payload = serde_json::json!({
        "identifier": "notif_user",
        "password": "Password123!"
    });
    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Extract auth cookie
    let (parts, _) = login_res.into_parts();
    let cookies_vec = parts.headers.get_all("set-cookie");
    let mut cookie_header = String::new();
    for c in cookies_vec {
        let s = c.to_str().unwrap();
        let p: Vec<&str> = s.split(';').collect();
        if !cookie_header.is_empty() {
            cookie_header.push_str("; ");
        }
        cookie_header.push_str(p[0]);
    }

    // 2. Create Notification (simulate backend event via SQL or Service helper)
    // Since we don't have a direct "create notification" API (it's internal), we insert via SQL
    let user_row: (uuid::Uuid,) =
        sqlx::query_as("SELECT id FROM users WHERE username = 'notif_user'")
            .fetch_one(&pool)
            .await
            .unwrap();
    let user_id = user_row.0;

    sqlx::query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)")
        .bind(user_id)
        .bind("Test Notification")
        .execute(&pool)
        .await
        .unwrap();

    // 3. List Notifications via API
    let list_uri = format!("/auth/notifications?user_id={}", user_id);
    let list_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(&list_uri)
                .header("cookie", &cookie_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let (parts, body) = list_res.into_parts();
    let body_bytes = to_bytes(body, usize::MAX).await.unwrap();
    let status = parts.status;

    if status != StatusCode::OK {
        println!("List Notif Error: {}", String::from_utf8_lossy(&body_bytes));
    }
    assert_eq!(status, StatusCode::OK);

    let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    let notifs = json["notifications"]
        .as_array()
        .expect("Should return notifications array");
    assert!(!notifs.is_empty(), "Should see created notification");
    let notif_id = notifs[0]["id"]
        .as_i64()
        .expect("Notification ID should be i64");

    // 4. Mark Read via API
    let read_uri = format!("/auth/notifications/{}/read?user_id={}", notif_id, user_id);
    let read_res = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(&read_uri)
                .header("cookie", &cookie_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(read_res.status(), StatusCode::OK);
}

#[sqlx::test]
async fn test_api_sessions_management(pool: PgPool) {
    let app = create_test_app(pool.clone()).await;

    // 1. Setup: Register & Login (Session 1)
    let reg_payload = serde_json::json!({
        "username": "sess_user",
        "email": "sess@example.com",
        "password": "Password123!"
    });
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(reg_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let login_payload = serde_json::json!({
        "identifier": "sess@example.com",
        "password": "Password123!"
    });
    // Login 1
    let login_res1 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let (parts1, _) = login_res1.into_parts();

    // Extract cookie 1
    let cookies_vec = parts1.headers.get_all("set-cookie");
    let mut cookie_header = String::new();
    for c in cookies_vec {
        let s = c.to_str().unwrap();
        let p: Vec<&str> = s.split(';').collect();
        if !cookie_header.is_empty() {
            cookie_header.push_str("; ");
        }
        cookie_header.push_str(p[0]);
    }

    // Login 2 (Create second session)
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // 2. List Sessions
    let list_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/auth/sessions")
                .header("cookie", &cookie_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(list_res.status(), StatusCode::OK);
    let body = to_bytes(list_res.into_body(), usize::MAX).await.unwrap();
    let sessions: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();
    assert!(sessions.len() >= 2, "Should have at least 2 sessions");

    // 3. Revoke one session (the other one, not current)
    // The session object has "id", not "session_id"
    let sess_id = sessions[0]["id"]
        .as_str()
        .expect("Session ID should be string");

    let revoke_uri = format!("/auth/sessions/{}", sess_id);
    let revoke_res = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(&revoke_uri)
                .header("cookie", &cookie_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    // 204 No Content
    assert_eq!(revoke_res.status(), StatusCode::NO_CONTENT);
}

#[sqlx::test]
async fn test_api_profile_update(pool: PgPool) {
    let app = create_test_app(pool.clone()).await;

    // 1. Setup
    let reg_payload = serde_json::json!({
        "username": "prof_user",
        "email": "prof@example.com",
        "password": "Password123!"
    });
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(reg_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let login_payload = serde_json::json!({
        "identifier": "prof@example.com",
        "password": "Password123!"
    });
    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let (parts, _) = login_res.into_parts();
    let cookies_vec = parts.headers.get_all("set-cookie");
    let mut cookie_header = String::new();
    for c in cookies_vec {
        let s = c.to_str().unwrap();
        let p: Vec<&str> = s.split(';').collect();
        if !cookie_header.is_empty() {
            cookie_header.push_str("; ");
        }
        cookie_header.push_str(p[0]);
    }

    // 2. Update Profile
    let update_payload = serde_json::json!({
        "username": "prof_updated"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri("/auth/profile")
                .header("content-type", "application/json")
                .header("cookie", cookie_header)
                .body(Body::from(update_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let user_json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(user_json["username"], "prof_updated");
}

#[sqlx::test]
async fn test_api_admin_functions(pool: PgPool) {
    let app = create_test_app(pool.clone()).await;

    // 1. Setup & Login
    let reg_payload = serde_json::json!({
        "username": "admin_user",
        "email": "admin@example.com",
        "password": "Password123!"
    });
    app.clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(reg_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let login_payload = serde_json::json!({
        "identifier": "admin@example.com",
        "password": "Password123!"
    });
    let login_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let (parts, _) = login_res.into_parts();
    let cookies_vec = parts.headers.get_all("set-cookie");
    let mut cookie_header = String::new();
    for c in cookies_vec {
        let s = c.to_str().unwrap();
        let p: Vec<&str> = s.split(';').collect();
        if !cookie_header.is_empty() {
            cookie_header.push_str("; ");
        }
        cookie_header.push_str(p[0]);
    }

    // 2. List All Sessions
    let sessions_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/auth/sessions/all")
                .header("cookie", &cookie_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(sessions_res.status(), StatusCode::OK);

    // 3. Get Audit Logs
    let audit_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/auth/audit-logs")
                .header("cookie", &cookie_header)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(audit_res.status(), StatusCode::OK);
}

// Helper to extract token from emails.log
fn extract_reset_token_from_log(email: &str) -> String {
    let log_content = std::fs::read_to_string("data/emails.log").expect("Failed to read emails.log");
    for line in log_content.lines().rev() {
        if line.contains(email) && line.contains("reset-password/") {
            // line format: ... Link: http://localhost:5373/reset-password/{token}
            let parts: Vec<&str> = line.split("reset-password/").collect();
            if parts.len() > 1 {
                return parts[1].trim().to_string();
            }
        }
    }
    panic!("Reset token not found for email: {}", email);
}

#[sqlx::test]
async fn test_forgot_password_invalid_email(pool: PgPool) {
    let app = create_test_app(pool).await;

    let payload = serde_json::json!({
        "email": "nonexistent@example.com"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/forgot-password")
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[sqlx::test]
async fn test_verify_invalid_token(pool: PgPool) {
    let app = create_test_app(pool).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/auth/verify-reset-token/invalid_token_123")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn test_password_reset_flow(pool: PgPool) {
    let app = create_test_app(pool).await;

    // 1. Register User
    let register_payload = serde_json::json!({
        "username": "reset_flow_user",
        "email": "reset_flow@example.com",
        "password": "OldPassword123!"
    });

    let reg_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(register_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(reg_res.status(), StatusCode::OK);

    // 2. Request Password Reset
    let forgot_payload = serde_json::json!({
        "email": "reset_flow@example.com"
    });

    let forgot_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/forgot-password")
                .header("content-type", "application/json")
                .body(Body::from(forgot_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(forgot_res.status(), StatusCode::OK);

    // 3. Extract Token from Log
    // Give a small delay to ensure FS write? usually instantaneous for local test
    let token = extract_reset_token_from_log("reset_flow@example.com");

    // 4. Verify Token
    let verify_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(&format!("/auth/verify-reset-token/{}", token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(verify_res.status(), StatusCode::OK);

    // 5. Reset Password
    let reset_payload = serde_json::json!({
        "token": token,
        "new_password": "NewPassword123!"
    });

    let reset_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/reset-password")
                .header("content-type", "application/json")
                .body(Body::from(reset_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(reset_res.status(), StatusCode::OK);

    // 6. Login with OLD Password (should fail)
    let login_old_payload = serde_json::json!({
        "identifier": "reset_flow@example.com",
        "password": "OldPassword123!"
    });

    let login_old_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_old_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(login_old_res.status(), StatusCode::UNAUTHORIZED);

    // 7. Login with NEW Password (should success)
    let login_new_payload = serde_json::json!({
        "identifier": "reset_flow@example.com",
        "password": "NewPassword123!"
    });

    let login_new_res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(login_new_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(login_new_res.status(), StatusCode::OK);
}
