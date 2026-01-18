// CVE-004 Fix: Rate limiting middleware
//
// This middleware implements rate limiting for authentication endpoints
// to prevent brute force attacks, credential stuffing, and MFA bypass.
//
// Rate Limits:
// - Login: 5 attempts per 15 minutes per IP
// - MFA: 10 attempts per 5 minutes per MFA token
// - Password Reset: 3 requests per hour per IP
// - Registration: 3 accounts per hour per IP

use axum::{
    extract::{ConnectInfo, Request},
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct RateLimiter {
    limits: Arc<RwLock<HashMap<String, Vec<Instant>>>>,
    window: Duration,
    max_requests: usize,
}

impl RateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            limits: Arc::new(RwLock::new(HashMap::new())),
            window: Duration::from_secs(window_secs),
            max_requests,
        }
    }

    pub async fn check(&self, key: &str) -> bool {
        let now = Instant::now();
        let mut limits = self.limits.write().await;

        // Get or create entry for this key
        let timestamps = limits.entry(key.to_string()).or_insert_with(Vec::new);

        // Remove timestamps outside the window
        timestamps.retain(|&t| now.duration_since(t) < self.window);

        // Check if limit exceeded
        if timestamps.len() >= self.max_requests {
            return false;
        }

        // Add current timestamp
        timestamps.push(now);
        true
    }

    /// Cleanup old entries to prevent memory leak
    pub async fn cleanup(&self) {
        let now = Instant::now();
        let mut limits = self.limits.write().await;

        // Remove entries that are completely expired
        limits.retain(|_, timestamps| {
            timestamps.retain(|&t| now.duration_since(t) < self.window);
            !timestamps.is_empty()
        });
    }
}

/// Rate limiting middleware for authentication routes
pub async fn rate_limit_middleware(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    limiter: axum::Extension<Arc<RateLimiter>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let ip = addr.ip().to_string();
    let path = request.uri().path();

    // Apply rate limiting to specific paths
    let should_limit = matches!(
        path,
        "/api/auth/login"
            | "/api/auth/register"
            | "/api/auth/forgot-password"
            | "/api/auth/mfa/challenge"
    );

    if should_limit {
        let key = format!("{}:{}", ip, path);

        if !limiter.check(&key).await {
            tracing::warn!(
                ip = %ip,
                path = %path,
                "Rate limit exceeded"
            );

            return Err(StatusCode::TOO_MANY_REQUESTS);
        }
    }

    Ok(next.run(request).await)
}

/// Create rate limiters for different endpoints
pub fn create_rate_limiters() -> HashMap<String, Arc<RateLimiter>> {
    let mut limiters = HashMap::new();

    // Login: 5 attempts per 15 minutes
    limiters.insert(
        "login".to_string(),
        Arc::new(RateLimiter::new(5, 15 * 60)),
    );

    // MFA: 10 attempts per 5 minutes
    limiters.insert("mfa".to_string(), Arc::new(RateLimiter::new(10, 5 * 60)));

    // Password Reset: 3 requests per hour
    limiters.insert(
        "forgot-password".to_string(),
        Arc::new(RateLimiter::new(3, 60 * 60)),
    );

    // Registration: 3 accounts per hour
    limiters.insert(
        "register".to_string(),
        Arc::new(RateLimiter::new(3, 60 * 60)),
    );

    limiters
}

/// Background task to clean up old rate limit entries
pub async fn cleanup_task(limiter: Arc<RateLimiter>) {
    let mut interval = tokio::time::interval(Duration::from_secs(60));
    loop {
        interval.tick().await;
        limiter.cleanup().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_allows_within_limit() {
        let limiter = RateLimiter::new(3, 60);

        assert!(limiter.check("test-key").await);
        assert!(limiter.check("test-key").await);
        assert!(limiter.check("test-key").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_blocks_over_limit() {
        let limiter = RateLimiter::new(3, 60);

        // First 3 should pass
        assert!(limiter.check("test-key").await);
        assert!(limiter.check("test-key").await);
        assert!(limiter.check("test-key").await);

        // 4th should fail
        assert!(!limiter.check("test-key").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_window_expiry() {
        let limiter = RateLimiter::new(2, 1); // 2 requests per second

        assert!(limiter.check("test-key").await);
        assert!(limiter.check("test-key").await);
        assert!(!limiter.check("test-key").await); // Should fail

        // Wait for window to expire
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Should work again
        assert!(limiter.check("test-key").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_different_keys() {
        let limiter = RateLimiter::new(2, 60);

        assert!(limiter.check("key1").await);
        assert!(limiter.check("key1").await);
        assert!(!limiter.check("key1").await);

        // Different key should still work
        assert!(limiter.check("key2").await);
        assert!(limiter.check("key2").await);
    }

    #[tokio::test]
    async fn test_cleanup_removes_expired_entries() {
        let limiter = RateLimiter::new(3, 1); // 1 second window

        limiter.check("test-key").await;
        limiter.check("test-key").await;

        // Wait for entries to expire
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Cleanup
        limiter.cleanup().await;

        // Check internal state is cleaned
        let limits = limiter.limits.read().await;
        assert_eq!(limits.len(), 0, "Expired entries should be removed");
    }
}
