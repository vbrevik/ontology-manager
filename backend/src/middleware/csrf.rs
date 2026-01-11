use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::Response,
};
use tower_cookies::{Cookies, Cookie};
use rand::{distributions::Alphanumeric, Rng};
use tower_cookies::cookie::time::Duration; // Correct Duration type for tower-cookies

pub const CSRF_COOKIE_NAME: &str = "csrf_token";
pub const CSRF_HEADER_NAME: &str = "X-CSRF-Token";

// Function to generate and set a new CSRF token cookie
// This should be called upon successful authentication (login/register)
pub fn set_csrf_cookie(cookies: &Cookies) {
    let token: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    let mut cookie = Cookie::new(CSRF_COOKIE_NAME, token);
    cookie.set_http_only(false); // MUST be readable by frontend JS
    cookie.set_path("/");
    cookie.set_same_site(tower_cookies::cookie::SameSite::Lax); // Match auth cookies
    cookie.set_secure(false); // Set to true in production with HTTPS
    // Set expiry effectively "session" or match auth token
    cookie.set_max_age(Duration::seconds(3600)); // 1 hour

    cookies.add(cookie);
}

// Middleware to validate CSRF token on unsafe methods
pub async fn validate_csrf(
    cookies: Cookies,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let method = req.method().clone();

    // Safe methods don't require CSRF validation
    if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        return Ok(next.run(req).await);
    }

    // Retrieve CSRF cookie
    let cookie_token = cookies
        .get(CSRF_COOKIE_NAME)
        .map(|c| c.value().to_string());

    // Retrieve CSRF header
    let header_token = req
        .headers()
        .get(CSRF_HEADER_NAME)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    // Validate
    match (&cookie_token, &header_token) {
        (Some(c), Some(h)) if c == h => {
            // Valid match
            Ok(next.run(req).await)
        }
        _ => {
            // Missing or mismatch
            tracing::warn!(
                "CSRF validation failed: Method={}, Uri={}, CookieTokenPresent={}, HeaderTokenPresent={}", 
                method, 
                req.uri(),
                cookie_token.is_some(),
                header_token.is_some()
            );
            if let (Some(c), Some(h)) = (cookie_token, header_token) {
                if c != h {
                    tracing::debug!("CSRF mismatch: Cookie={}, Header={}", c, h);
                }
            }
            Err(StatusCode::FORBIDDEN)
        }
    }
}
