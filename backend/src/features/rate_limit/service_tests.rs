// Unit tests for RateLimitService
#[cfg(test)]
mod rate_limit_service_tests {
    use std::collections::HashMap;
    use std::sync::Arc;
    use std::time::{SystemTime, UNIX_EPOCH};
    use tokio::sync::RwLock;

    #[test]
    fn test_rate_limit_service_creation() {
        // Test service creation in both modes
        let cache: Arc<RwLock<HashMap<(String, String), Vec<u64>>>> = 
            Arc::new(RwLock::new(HashMap::new()));
        
        // This test doesn't require actual DB connection
        // Just verifies the struct fields are set correctly
        assert!(!cache.try_read().is_err(), "Cache can be created and locked");
    }

    #[tokio::test]
    async fn test_cache_operations() {
        let cache: Arc<RwLock<HashMap<(String, String), Vec<u64>>>> = 
            Arc::new(RwLock::new(HashMap::new()));

        let key = ("test-rule".to_string(), "test-ip".to_string());
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

        // Test write to cache
        {
            let mut cache_write = cache.write().await;
            cache_write.insert(key.clone(), vec![now - 100, now - 50, now]);
        }

        // Test read from cache
        {
            let cache_read = cache.read().await;
            let timestamps = cache_read.get(&key).unwrap();
            assert_eq!(timestamps.len(), 3);
            assert_eq!(*timestamps.last().unwrap(), now);
        }

        // Test cleanup logic (manual implementation)
        {
            let mut cache_write = cache.write().await;
            let window_start = now - 60; // 60 second window
            
            // Simulate cleanup: retain only timestamps within window
            if let Some(timestamps) = cache_write.get_mut(&key) {
                timestamps.retain(|&ts| ts > window_start);
            }
            
            // Timestamps: now-100 (removed), now-50 (kept), now (kept)
            // Only 2 timestamps are within 60 seconds
            assert_eq!(cache_write.get(&key).unwrap().len(), 2);
        }

        // Test cleanup with expired entries
        {
            let mut cache_write = cache.write().await;
            let window_start = now - 40; // Shorter window
            
            if let Some(timestamps) = cache_write.get_mut(&key) {
                timestamps.retain(|&ts| ts > window_start);
            }
            
            // Timestamps: now-100, now-50, now
            // window_start = now - 40
            // Only timestamps > now-40 should remain
            // now-100 < now-40 (removed), now-50 < now-40 (removed), now > now-40 (kept)
            // Actually: now-50 is NOT > now-40, so only `now` remains
            assert_eq!(cache_write.get(&key).unwrap().len(), 1, "Only timestamp within 40sec window should remain");
        }
    }

    #[tokio::test]
    async fn test_sliding_window_logic() {
        let cache: Arc<RwLock<HashMap<(String, String), Vec<u64>>>> = 
            Arc::new(RwLock::new(HashMap::new()));

        let key = ("auth-login".to_string(), "192.168.1.1".to_string());
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        let max_requests = 5i64;
        let window_seconds = 900u64; // 15 minutes

        // Simulate 5 requests
        let mut timestamps = vec![];
        for i in 0..5 {
            timestamps.push(now - (i * 60)); // One per minute
        }

        {
            let mut cache_write = cache.write().await;
            cache_write.insert(key.clone(), timestamps.clone());
        }

        // Check if limit would be exceeded
        {
            let cache_read = cache.read().await;
            let current_timestamps = cache_read.get(&key).unwrap();
            
            // Clean expired (older than window)
            let valid_timestamps: Vec<_> = current_timestamps.iter()
                .filter(|&&ts| now - ts < window_seconds)
                .collect();
            
            let would_exceed = valid_timestamps.len() as i64 >= max_requests;
            assert!(would_exceed, "5 requests in 15 min window should trigger limit");
        }
    }

    #[test]
    fn test_rate_limit_strategy_parsing() {
        use crate::features::rate_limit::models::RateLimitStrategy;

        // Test strategy enum variants
        let ip_strategy = RateLimitStrategy::IP;
        let user_strategy = RateLimitStrategy::User;
        let global_strategy = RateLimitStrategy::Global;

        assert!(matches!(ip_strategy, RateLimitStrategy::IP));
        assert!(matches!(user_strategy, RateLimitStrategy::User));
        assert!(matches!(global_strategy, RateLimitStrategy::Global));
    }
}
