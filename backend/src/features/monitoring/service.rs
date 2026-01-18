use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use super::models::*;
use super::alerts::AlertSystem;

/// Monitoring Service
/// Handles security event logging, failed auth tracking, and alert evaluation
#[derive(Clone)]
pub struct MonitoringService {
    db: PgPool,
    alert_system: Arc<AlertSystem>,
}

impl MonitoringService {
    pub fn new(db: PgPool, alert_system: Arc<AlertSystem>) -> Self {
        Self { db, alert_system }
    }

    /// Log a failed authentication attempt
    pub async fn log_failed_auth(
        &self,
        request: CreateFailedAuthAttempt,
    ) -> Result<Uuid, sqlx::Error> {
        let metadata = request
            .metadata
            .unwrap_or_else(|| serde_json::json!({}));

        let id = sqlx::query_scalar!(
            r#"
            SELECT log_failed_auth(
                $1::VARCHAR,
                $2::UUID,
                $3::INET,
                $4::TEXT,
                $5::VARCHAR,
                $6::VARCHAR,
                $7::JSONB
            ) as "id!"
            "#,
            request.attempted_identifier,
            request.user_id,
            request.ip_address,
            request.user_agent,
            request.endpoint,
            request.failure_reason,
            metadata
        )
        .fetch_one(&self.db)
        .await?;

        // Check if we should alert on this
        self.check_and_trigger_alerts().await.ok();

        Ok(id)
    }

    /// Log a security event
    pub async fn log_security_event(
        &self,
        request: CreateSecurityEvent,
    ) -> Result<Uuid, sqlx::Error> {
        let details = request.details.unwrap_or_else(|| serde_json::json!({}));

        let id = sqlx::query_scalar!(
            r#"
            SELECT log_security_event(
                $1::VARCHAR,
                $2::VARCHAR,
                $3::UUID,
                $4::INET,
                $5::VARCHAR,
                $6::VARCHAR,
                $7::VARCHAR,
                $8::JSONB
            ) as "id!"
            "#,
            request.event_type,
            request.severity.as_str(),
            request.user_id,
            request.ip_address,
            request.resource,
            request.action,
            request.outcome.as_str(),
            details
        )
        .fetch_one(&self.db)
        .await?;

        // If critical, immediately check alerts
        if request.severity == Severity::Critical {
            self.check_and_trigger_alerts().await.ok();
        }

        Ok(id)
    }

    /// Get recent failed auth attempts by IP
    pub async fn get_failed_auth_by_ip(&self) -> Result<Vec<FailedAuthByIp>, sqlx::Error> {
        sqlx::query_as!(
            FailedAuthByIp,
            r#"
            SELECT 
                ip_address,
                attempt_count,
                unique_identifiers,
                endpoints_attempted,
                first_attempt,
                last_attempt,
                duration_minutes
            FROM recent_failed_auth_by_ip
            "#
        )
        .fetch_all(&self.db)
        .await
    }

    /// Get security event summary
    pub async fn get_security_event_summary(
        &self,
    ) -> Result<Vec<SecurityEventSummary>, sqlx::Error> {
        sqlx::query_as!(
            SecurityEventSummary,
            r#"
            SELECT 
                event_type,
                severity as "severity!: Severity",
                event_count,
                unique_users,
                unique_ips,
                last_occurrence,
                pending_alerts
            FROM security_event_summary
            "#
        )
        .fetch_all(&self.db)
        .await
    }

    /// Get recent security events
    pub async fn get_recent_security_events(
        &self,
        limit: i64,
    ) -> Result<Vec<SecurityEvent>, sqlx::Error> {
        sqlx::query_as!(
            SecurityEvent,
            r#"
            SELECT 
                id,
                event_type,
                severity as "severity!: Severity",
                user_id,
                ip_address,
                user_agent,
                resource,
                action,
                outcome as "outcome!: Outcome",
                details,
                request_id,
                session_id,
                detected_at,
                alerted,
                alerted_at,
                created_at
            FROM security_events
            ORDER BY detected_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await
    }

    /// Get recent failed auth attempts
    pub async fn get_recent_failed_auth(
        &self,
        limit: i64,
    ) -> Result<Vec<FailedAuthAttempt>, sqlx::Error> {
        sqlx::query_as!(
            FailedAuthAttempt,
            r#"
            SELECT 
                id,
                attempted_identifier,
                user_id,
                ip_address,
                user_agent,
                request_id,
                endpoint,
                failure_reason,
                metadata,
                attempted_at,
                created_at
            FROM failed_auth_attempts
            ORDER BY attempted_at DESC
            LIMIT $1
            "#,
            limit
        )
        .fetch_all(&self.db)
        .await
    }

    /// Check alert rules and trigger alerts if needed
    pub async fn check_and_trigger_alerts(&self) -> Result<usize, Box<dyn std::error::Error>> {
        let triggers = sqlx::query_as!(
            AlertTrigger,
            r#"
            SELECT 
                rule_id,
                rule_name,
                event_count,
                should_alert
            FROM check_alert_rules()
            "#
        )
        .fetch_all(&self.db)
        .await?;

        let mut triggered_count = 0;

        for trigger in triggers {
            if trigger.should_alert {
                // Get the rule details
                let rule = sqlx::query_as!(
                    AlertRule,
                    r#"
                    SELECT 
                        id,
                        rule_name,
                        description,
                        enabled,
                        event_type,
                        min_severity,
                        threshold_count,
                        threshold_window_minutes,
                        group_by,
                        alert_channel,
                        alert_cooldown_minutes,
                        last_triggered_at,
                        total_triggers,
                        created_at,
                        updated_at
                    FROM alert_rules
                    WHERE id = $1
                    "#,
                    trigger.rule_id
                )
                .fetch_one(&self.db)
                .await?;

                // Send alert
                self.alert_system
                    .send_alert(&rule, trigger.event_count)
                    .await
                    .ok();

                // Update rule last_triggered_at
                sqlx::query!(
                    r#"
                    UPDATE alert_rules
                    SET 
                        last_triggered_at = NOW(),
                        total_triggers = total_triggers + 1
                    WHERE id = $1
                    "#,
                    rule.id
                )
                .execute(&self.db)
                .await?;

                triggered_count += 1;
            }
        }

        Ok(triggered_count)
    }

    /// Get alert rules
    pub async fn get_alert_rules(&self) -> Result<Vec<AlertRule>, sqlx::Error> {
        sqlx::query_as!(
            AlertRule,
            r#"
            SELECT 
                id,
                rule_name,
                description,
                enabled,
                event_type,
                min_severity,
                threshold_count,
                threshold_window_minutes,
                group_by,
                alert_channel,
                alert_cooldown_minutes,
                last_triggered_at,
                total_triggers,
                created_at,
                updated_at
            FROM alert_rules
            ORDER BY total_triggers DESC
            "#
        )
        .fetch_all(&self.db)
        .await
    }

    /// Cleanup old security logs
    pub async fn cleanup_old_logs(&self) -> Result<(i32, i32, i32), sqlx::Error> {
        let result = sqlx::query!(
            r#"
            SELECT * FROM cleanup_old_security_logs()
            AS (failed_auth_deleted INTEGER, security_events_deleted INTEGER, suspicious_queries_deleted INTEGER)
            "#
        )
        .fetch_one(&self.db)
        .await?;

        Ok((
            result.failed_auth_deleted.unwrap_or(0),
            result.security_events_deleted.unwrap_or(0),
            result.suspicious_queries_deleted.unwrap_or(0),
        ))
    }

    /// Check for suspicious activity from IP
    pub async fn check_suspicious_ip(&self, ip: &str) -> Result<bool, sqlx::Error> {
        let count = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)
            FROM failed_auth_attempts
            WHERE ip_address = $1::INET
            AND attempted_at > NOW() - INTERVAL '5 minutes'
            "#,
            ip
        )
        .fetch_one(&self.db)
        .await?;

        // Suspicious if more than 10 attempts in 5 minutes
        Ok(count.unwrap_or(0) > 10)
    }

    /// Get statistics for dashboard
    pub async fn get_dashboard_stats(&self) -> Result<DashboardStats, sqlx::Error> {
        // Failed auth in last hour
        let failed_auth_hour = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)
            FROM failed_auth_attempts
            WHERE attempted_at > NOW() - INTERVAL '1 hour'
            "#
        )
        .fetch_one(&self.db)
        .await?
        .unwrap_or(0);

        // Security events in last hour
        let security_events_hour = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)
            FROM security_events
            WHERE detected_at > NOW() - INTERVAL '1 hour'
            "#
        )
        .fetch_one(&self.db)
        .await?
        .unwrap_or(0);

        // Critical events in last 24 hours
        let critical_events_24h = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)
            FROM security_events
            WHERE severity = 'critical'
            AND detected_at > NOW() - INTERVAL '24 hours'
            "#
        )
        .fetch_one(&self.db)
        .await?
        .unwrap_or(0);

        // Unique IPs with failed auth in last hour
        let unique_attacking_ips = sqlx::query_scalar!(
            r#"
            SELECT COUNT(DISTINCT ip_address)
            FROM failed_auth_attempts
            WHERE attempted_at > NOW() - INTERVAL '1 hour'
            "#
        )
        .fetch_one(&self.db)
        .await?
        .unwrap_or(0);

        // Alerts triggered in last 24 hours
        let alerts_24h = sqlx::query_scalar!(
            r#"
            SELECT SUM(total_triggers)
            FROM alert_rules
            WHERE last_triggered_at > NOW() - INTERVAL '24 hours'
            "#
        )
        .fetch_one(&self.db)
        .await?
        .unwrap_or(0);

        Ok(DashboardStats {
            failed_auth_last_hour: failed_auth_hour,
            security_events_last_hour: security_events_hour,
            critical_events_24h: critical_events_24h,
            unique_attacking_ips: unique_attacking_ips,
            alerts_triggered_24h: alerts_24h as i64,
        })
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DashboardStats {
    pub failed_auth_last_hour: i64,
    pub security_events_last_hour: i64,
    pub critical_events_24h: i64,
    pub unique_attacking_ips: i64,
    pub alerts_triggered_24h: i64,
}
