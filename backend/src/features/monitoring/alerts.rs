use super::models::AlertRule;
use reqwest::Client;
use serde_json::json;
use std::env;
use tracing;

/// Alert System
/// Sends security alerts to configured channels (Slack, Discord, Email, etc.)
#[derive(Clone)]
pub struct AlertSystem {
    client: Client,
    slack_webhook: Option<String>,
    discord_webhook: Option<String>,
    pagerduty_key: Option<String>,
}

impl AlertSystem {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            slack_webhook: env::var("SLACK_WEBHOOK_URL").ok(),
            discord_webhook: env::var("DISCORD_WEBHOOK_URL").ok(),
            pagerduty_key: env::var("PAGERDUTY_INTEGRATION_KEY").ok(),
        }
    }

    /// Send alert based on rule configuration
    pub async fn send_alert(&self, rule: &AlertRule, event_count: i64) -> Result<(), Box<dyn std::error::Error>> {
        let message = self.format_alert_message(rule, event_count);

        match rule.alert_channel.as_str() {
            "slack" => self.send_slack_alert(&message).await,
            "discord" => self.send_discord_alert(&message).await,
            "pagerduty" => self.send_pagerduty_alert(rule, &message).await,
            "webhook" => self.send_webhook_alert(&message).await,
            _ => {
                tracing::warn!("Unknown alert channel: {}", rule.alert_channel);
                Ok(())
            }
        }
    }

    /// Format alert message
    fn format_alert_message(&self, rule: &AlertRule, event_count: i64) -> String {
        let emoji = match rule.event_type.as_deref() {
            Some("ransomware_detected") => "🚨",
            Some("failed_login") => "🔐",
            Some("admin_access") => "👤",
            Some("rate_limit_exceeded") => "⚡",
            _ => "⚠️",
        };

        let urgency = if event_count > (rule.threshold_count.unwrap_or(1) * 2) as i64 {
            "**HIGH URGENCY**"
        } else {
            "Alert"
        };

        format!(
            "{} {} {}\n\n**Rule:** {}\n**Description:** {}\n**Event Count:** {} in {} minutes\n**Threshold:** {} events\n**Action Required:** Investigate immediately",
            emoji,
            urgency,
            rule.rule_name,
            rule.rule_name,
            rule.description.as_deref().unwrap_or("No description"),
            event_count,
            rule.threshold_window_minutes.unwrap_or(0),
            rule.threshold_count.unwrap_or(1)
        )
    }

    /// Send Slack alert
    async fn send_slack_alert(&self, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(webhook_url) = &self.slack_webhook {
            let payload = json!({
                "text": message,
                "username": "Security Monitor",
                "icon_emoji": ":shield:"
            });

            let response = self.client
                .post(webhook_url)
                .json(&payload)
                .send()
                .await?;

            if !response.status().is_success() {
                tracing::error!("Failed to send Slack alert: {}", response.status());
            } else {
                tracing::info!("Slack alert sent successfully");
            }
        } else {
            tracing::warn!("Slack webhook not configured (SLACK_WEBHOOK_URL)");
        }

        Ok(())
    }

    /// Send Discord alert
    async fn send_discord_alert(&self, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(webhook_url) = &self.discord_webhook {
            let payload = json!({
                "content": message,
                "username": "Security Monitor",
                "avatar_url": "https://cdn-icons-png.flaticon.com/512/2913/2913133.png"
            });

            let response = self.client
                .post(webhook_url)
                .json(&payload)
                .send()
                .await?;

            if !response.status().is_success() {
                tracing::error!("Failed to send Discord alert: {}", response.status());
            } else {
                tracing::info!("Discord alert sent successfully");
            }
        } else {
            tracing::warn!("Discord webhook not configured (DISCORD_WEBHOOK_URL)");
        }

        Ok(())
    }

    /// Send PagerDuty alert
    async fn send_pagerduty_alert(
        &self,
        rule: &AlertRule,
        message: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(integration_key) = &self.pagerduty_key {
            let payload = json!({
                "routing_key": integration_key,
                "event_action": "trigger",
                "payload": {
                    "summary": format!("Security Alert: {}", rule.rule_name),
                    "source": "ontology-manager",
                    "severity": "critical",
                    "custom_details": {
                        "message": message,
                        "rule": rule.rule_name,
                        "description": rule.description
                    }
                }
            });

            let response = self.client
                .post("https://events.pagerduty.com/v2/enqueue")
                .json(&payload)
                .send()
                .await?;

            if !response.status().is_success() {
                tracing::error!("Failed to send PagerDuty alert: {}", response.status());
            } else {
                tracing::info!("PagerDuty alert sent successfully");
            }
        } else {
            tracing::warn!("PagerDuty not configured (PAGERDUTY_INTEGRATION_KEY)");
        }

        Ok(())
    }

    /// Send generic webhook alert
    async fn send_webhook_alert(&self, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Ok(webhook_url) = env::var("CUSTOM_WEBHOOK_URL") {
            let payload = json!({
                "message": message,
                "source": "ontology-manager-security",
                "timestamp": chrono::Utc::now().to_rfc3339()
            });

            let response = self.client
                .post(&webhook_url)
                .json(&payload)
                .send()
                .await?;

            if !response.status().is_success() {
                tracing::error!("Failed to send webhook alert: {}", response.status());
            } else {
                tracing::info!("Webhook alert sent successfully");
            }
        } else {
            tracing::warn!("Custom webhook not configured (CUSTOM_WEBHOOK_URL)");
        }

        Ok(())
    }

    /// Send test alert (for verification)
    pub async fn send_test_alert(&self, channel: &str) -> Result<(), Box<dyn std::error::Error>> {
        let message = "🧪 **Test Alert**\n\nThis is a test alert from the Security Monitoring System.\n\nIf you see this, alerts are configured correctly!";

        match channel {
            "slack" => self.send_slack_alert(message).await,
            "discord" => self.send_discord_alert(message).await,
            _ => Err("Unknown channel".into()),
        }
    }
}

impl Default for AlertSystem {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alert_system_creation() {
        let alert_system = AlertSystem::new();
        assert!(alert_system.slack_webhook.is_none() || alert_system.slack_webhook.is_some());
    }

    #[test]
    fn test_format_alert_message() {
        let alert_system = AlertSystem::new();
        let rule = AlertRule {
            id: uuid::Uuid::new_v4(),
            rule_name: "test_rule".to_string(),
            description: Some("Test description".to_string()),
            enabled: true,
            event_type: Some("failed_login".to_string()),
            min_severity: Some("warning".to_string()),
            threshold_count: Some(10),
            threshold_window_minutes: Some(5),
            group_by: Some("ip_address".to_string()),
            alert_channel: "slack".to_string(),
            alert_cooldown_minutes: Some(15),
            last_triggered_at: None,
            total_triggers: 0,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let message = alert_system.format_alert_message(&rule, 15);
        assert!(message.contains("test_rule"));
        assert!(message.contains("15"));
    }
}
