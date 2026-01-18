use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};
use std::collections::HashMap;

/// Monitoring Analytics Service
/// Provides aggregations, trends, and insights from monitoring data
#[derive(Clone)]
pub struct MonitoringAnalytics {
    db: PgPool,
}

/// Timeline event for unified view
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TimelineEvent {
    pub id: uuid::Uuid,
    pub event_class: String,
    pub display_name: String,
    pub occurred_at: DateTime<Utc>,
    pub severity: String,
    pub attributes: serde_json::Value,
    pub user_id: Option<uuid::Uuid>,
}

/// Hourly aggregation
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct HourlyStats {
    pub hour: DateTime<Utc>,
    pub event_class: String,
    pub severity: String,
    pub event_count: i64,
}

/// IP reputation data
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct IPReputation {
    pub ip_address: String,
    pub event_class: String,
    pub event_count: i64,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub severities: Vec<String>,
}

/// User activity summary
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserActivitySummary {
    pub user_id: uuid::Uuid,
    pub username: Option<String>,
    pub email: Option<String>,
    pub total_events: i64,
    pub failed_auths: i64,
    pub session_events: i64,
    pub api_requests: i64,
    pub data_accesses: i64,
    pub critical_events: i64,
    pub first_event: DateTime<Utc>,
    pub last_event: DateTime<Utc>,
}

/// Event type distribution
#[derive(Debug, Serialize, Deserialize)]
pub struct EventDistribution {
    pub event_class: String,
    pub count: i64,
    pub percentage: f64,
}

/// Trend data point
#[derive(Debug, Serialize, Deserialize)]
pub struct TrendPoint {
    pub timestamp: DateTime<Utc>,
    pub value: i64,
}

/// Dashboard statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_events_24h: i64,
    pub critical_events_24h: i64,
    pub failed_auth_24h: i64,
    pub unique_users_24h: i64,
    pub unique_ips_24h: i64,
    pub top_event_type: String,
    pub avg_api_response_time_ms: Option<f64>,
    pub active_alerts: i64,
}

/// Anomaly detection result
#[derive(Debug, Serialize, Deserialize)]
pub struct Anomaly {
    pub entity_id: uuid::Uuid,
    pub anomaly_type: String,
    pub score: f64,
    pub description: String,
    pub occurred_at: DateTime<Utc>,
    pub attributes: serde_json::Value,
}

impl MonitoringAnalytics {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Get unified timeline of all monitoring events
    pub async fn get_timeline(
        &self,
        limit: i64,
        offset: i64,
        event_classes: Option<Vec<String>>,
        severity: Option<String>,
        since: Option<DateTime<Utc>>,
    ) -> Result<Vec<TimelineEvent>, sqlx::Error> {
        let since = since.unwrap_or_else(|| Utc::now() - Duration::hours(24));
        
        let query = if let Some(classes) = event_classes {
            sqlx::query_as!(
                TimelineEvent,
                r#"
                SELECT 
                    id,
                    event_class,
                    display_name,
                    occurred_at,
                    severity,
                    attributes,
                    user_id
                FROM monitoring_events_timeline
                WHERE occurred_at >= $1
                  AND event_class = ANY($2)
                  AND ($3::text IS NULL OR severity = $3)
                ORDER BY occurred_at DESC
                LIMIT $4 OFFSET $5
                "#,
                since,
                &classes,
                severity,
                limit,
                offset
            )
            .fetch_all(&self.db)
            .await
        } else {
            sqlx::query_as!(
                TimelineEvent,
                r#"
                SELECT 
                    id,
                    event_class,
                    display_name,
                    occurred_at,
                    severity,
                    attributes,
                    user_id
                FROM monitoring_events_timeline
                WHERE occurred_at >= $1
                  AND ($2::text IS NULL OR severity = $2)
                ORDER BY occurred_at DESC
                LIMIT $3 OFFSET $4
                "#,
                since,
                severity,
                limit,
                offset
            )
            .fetch_all(&self.db)
            .await
        };
        
        query
    }

    /// Get hourly statistics
    pub async fn get_hourly_stats(
        &self,
        hours: i64,
    ) -> Result<Vec<HourlyStats>, sqlx::Error> {
        sqlx::query_as!(
            HourlyStats,
            r#"
            SELECT 
                date_trunc('hour', occurred_at) as "hour!",
                event_class as "event_class!",
                severity as "severity!",
                COUNT(*) as "event_count!"
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - ($1 || ' hours')::INTERVAL
            GROUP BY date_trunc('hour', occurred_at), event_class, severity
            ORDER BY hour DESC
            "#,
            hours
        )
        .fetch_all(&self.db)
        .await
    }

    /// Get top attacking IPs
    pub async fn get_top_attacking_ips(
        &self,
        limit: i64,
    ) -> Result<Vec<IPReputation>, sqlx::Error> {
        sqlx::query_as!(
            IPReputation,
            r#"
            SELECT 
                ip_address as "ip_address!",
                event_class as "event_class!",
                event_count as "event_count!",
                first_seen as "first_seen!",
                last_seen as "last_seen!",
                severities as "severities!"
            FROM monitoring_top_attacking_ips
            ORDER BY event_count DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await
    }

    /// Get user activity summary
    pub async fn get_user_activity(
        &self,
        limit: i64,
    ) -> Result<Vec<UserActivitySummary>, sqlx::Error> {
        sqlx::query_as!(
            UserActivitySummary,
            r#"
            SELECT 
                user_id as "user_id!",
                username,
                email,
                total_events as "total_events!",
                failed_auths as "failed_auths!",
                session_events as "session_events!",
                api_requests as "api_requests!",
                data_accesses as "data_accesses!",
                critical_events as "critical_events!",
                first_event as "first_event!",
                last_event as "last_event!"
            FROM monitoring_user_activity_summary
            ORDER BY total_events DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await
    }

    /// Get event distribution (pie chart data)
    pub async fn get_event_distribution(
        &self,
        hours: i64,
    ) -> Result<Vec<EventDistribution>, sqlx::Error> {
        let results = sqlx::query!(
            r#"
            SELECT 
                event_class,
                COUNT(*) as count
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - ($1 || ' hours')::INTERVAL
            GROUP BY event_class
            ORDER BY count DESC
            "#,
            hours
        )
        .fetch_all(&self.db)
        .await?;

        let total: i64 = results.iter().map(|r| r.count.unwrap_or(0)).sum();

        Ok(results
            .into_iter()
            .map(|r| EventDistribution {
                event_class: r.event_class,
                count: r.count.unwrap_or(0),
                percentage: if total > 0 {
                    (r.count.unwrap_or(0) as f64 / total as f64) * 100.0
                } else {
                    0.0
                },
            })
            .collect())
    }

    /// Get trend for specific event type
    pub async fn get_event_trend(
        &self,
        event_class: &str,
        hours: i64,
        interval_minutes: i64,
    ) -> Result<Vec<TrendPoint>, sqlx::Error> {
        let results = sqlx::query!(
            r#"
            SELECT 
                date_trunc('hour', occurred_at) + 
                (EXTRACT(MINUTE FROM occurred_at)::int / $1) * ($1 || ' minutes')::interval as bucket,
                COUNT(*) as count
            FROM monitoring_events_timeline
            WHERE event_class = $2
              AND occurred_at > NOW() - ($3 || ' hours')::INTERVAL
            GROUP BY bucket
            ORDER BY bucket ASC
            "#,
            interval_minutes,
            event_class,
            hours
        )
        .fetch_all(&self.db)
        .await?;

        Ok(results
            .into_iter()
            .map(|r| TrendPoint {
                timestamp: r.bucket.unwrap_or_else(Utc::now),
                value: r.count.unwrap_or(0),
            })
            .collect())
    }

    /// Get dashboard statistics
    pub async fn get_dashboard_stats(&self) -> Result<DashboardStats, sqlx::Error> {
        // Total events in last 24h
        let total_events_24h = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::BIGINT as "count!"
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - INTERVAL '24 hours'
            "#
        )
        .fetch_one(&self.db)
        .await?;

        // Critical events in last 24h
        let critical_events_24h = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::BIGINT as "count!"
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - INTERVAL '24 hours'
              AND severity = 'critical'
            "#
        )
        .fetch_one(&self.db)
        .await?;

        // Failed auth in last 24h
        let failed_auth_24h = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::BIGINT as "count!"
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - INTERVAL '24 hours'
              AND event_class = 'FailedAuthAttempt'
            "#
        )
        .fetch_one(&self.db)
        .await?;

        // Unique users in last 24h
        let unique_users_24h = sqlx::query_scalar!(
            r#"
            SELECT COUNT(DISTINCT user_id)::BIGINT as "count!"
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - INTERVAL '24 hours'
              AND user_id IS NOT NULL
            "#
        )
        .fetch_one(&self.db)
        .await?;

        // Unique IPs in last 24h
        let unique_ips_24h = sqlx::query_scalar!(
            r#"
            SELECT COUNT(DISTINCT attributes->>'ip_address')::BIGINT as "count!"
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - INTERVAL '24 hours'
              AND attributes->>'ip_address' IS NOT NULL
            "#
        )
        .fetch_one(&self.db)
        .await?;

        // Top event type
        let top_event = sqlx::query!(
            r#"
            SELECT event_class, COUNT(*) as count
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - INTERVAL '24 hours'
            GROUP BY event_class
            ORDER BY count DESC
            LIMIT 1
            "#
        )
        .fetch_optional(&self.db)
        .await?;

        // Average API response time
        let avg_response_time = sqlx::query_scalar!(
            r#"
            SELECT AVG((attributes->>'response_time_ms')::INTEGER)::FLOAT8
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - INTERVAL '24 hours'
              AND event_class = 'APIRequestEvent'
              AND attributes->>'response_time_ms' IS NOT NULL
            "#
        )
        .fetch_one(&self.db)
        .await?;

        // Active alerts (not yet alerted security events)
        let active_alerts = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::BIGINT as "count!"
            FROM entities e
            JOIN classes c ON c.id = e.class_id
            WHERE c.name = 'SecurityEvent'
              AND (e.attributes->>'alerted')::BOOLEAN = FALSE
              AND (e.attributes->>'severity') IN ('warning', 'critical')
            "#
        )
        .fetch_one(&self.db)
        .await?;

        Ok(DashboardStats {
            total_events_24h,
            critical_events_24h,
            failed_auth_24h,
            unique_users_24h,
            unique_ips_24h,
            top_event_type: top_event.map(|e| e.event_class).unwrap_or_else(|| "N/A".to_string()),
            avg_api_response_time_ms: avg_response_time,
            active_alerts,
        })
    }

    /// Detect anomalies using simple heuristics
    pub async fn detect_anomalies(
        &self,
        hours: i64,
    ) -> Result<Vec<Anomaly>, sqlx::Error> {
        let mut anomalies = Vec::new();

        // Anomaly 1: Rapid failed auth attempts (10+ in 5 minutes)
        let rapid_failed_auth = sqlx::query!(
            r#"
            SELECT 
                id,
                attributes,
                occurred_at
            FROM monitoring_events_timeline
            WHERE event_class = 'FailedAuthAttempt'
              AND occurred_at > NOW() - ($1 || ' hours')::INTERVAL
            "#,
            hours
        )
        .fetch_all(&self.db)
        .await?;

        // Group by IP and check for rapid attempts
        let mut ip_attempts: HashMap<String, Vec<DateTime<Utc>>> = HashMap::new();
        for attempt in rapid_failed_auth {
            if let Some(ip) = attempt.attributes.get("ip_address").and_then(|v| v.as_str()) {
                ip_attempts
                    .entry(ip.to_string())
                    .or_insert_with(Vec::new)
                    .push(attempt.occurred_at);
            }
        }

        for (ip, timestamps) in ip_attempts {
            let mut sorted = timestamps.clone();
            sorted.sort();
            
            // Check for 10+ attempts in 5 minutes
            for window_start in 0..sorted.len() {
                let window_end = sorted.iter().position(|&t| {
                    t > sorted[window_start] + Duration::minutes(5)
                }).unwrap_or(sorted.len());
                
                let count_in_window = window_end - window_start;
                if count_in_window >= 10 {
                    anomalies.push(Anomaly {
                        entity_id: uuid::Uuid::new_v4(),
                        anomaly_type: "rapid_failed_auth".to_string(),
                        score: count_in_window as f64 / 10.0,
                        description: format!("{} failed auth attempts from {} in 5 minutes", count_in_window, ip),
                        occurred_at: sorted[window_start],
                        attributes: serde_json::json!({
                            "ip_address": ip,
                            "attempt_count": count_in_window,
                            "time_window_minutes": 5
                        }),
                    });
                    break;
                }
            }
        }

        // Anomaly 2: Unusual API response times (>1000ms)
        let slow_apis = sqlx::query!(
            r#"
            SELECT 
                id,
                attributes,
                occurred_at
            FROM monitoring_events_timeline
            WHERE event_class = 'APIRequestEvent'
              AND (attributes->>'response_time_ms')::INTEGER > 1000
              AND occurred_at > NOW() - ($1 || ' hours')::INTERVAL
            ORDER BY (attributes->>'response_time_ms')::INTEGER DESC
            LIMIT 10
            "#,
            hours
        )
        .fetch_all(&self.db)
        .await?;

        for api in slow_apis {
            if let Some(response_time) = api.attributes.get("response_time_ms").and_then(|v| v.as_i64()) {
                anomalies.push(Anomaly {
                    entity_id: api.id,
                    anomaly_type: "slow_api_response".to_string(),
                    score: (response_time as f64 / 1000.0).min(10.0),
                    description: format!("API response time: {}ms", response_time),
                    occurred_at: api.occurred_at,
                    attributes: api.attributes,
                });
            }
        }

        Ok(anomalies)
    }

    /// Get severity breakdown
    pub async fn get_severity_breakdown(
        &self,
        hours: i64,
    ) -> Result<HashMap<String, i64>, sqlx::Error> {
        let results = sqlx::query!(
            r#"
            SELECT 
                severity,
                COUNT(*) as count
            FROM monitoring_events_timeline
            WHERE occurred_at > NOW() - ($1 || ' hours')::INTERVAL
            GROUP BY severity
            "#,
            hours
        )
        .fetch_all(&self.db)
        .await?;

        Ok(results
            .into_iter()
            .map(|r| (r.severity, r.count.unwrap_or(0)))
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analytics_creation() {
        // Test would require database connection
        // This is a placeholder to ensure module compiles
        assert!(true);
    }
}
