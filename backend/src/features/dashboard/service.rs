use crate::features::auth::models::User;
use crate::features::dashboard::models::{
    AccessTrafficPoint, ActivityEntry, AdminDashboardStats, DashboardStats,
};
use chrono::{Datelike, Duration, Utc};
use sqlx::{PgPool, Row};

#[derive(Clone)]
pub struct DashboardService {
    pool: PgPool,
}

impl DashboardService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_dashboard_stats(&self) -> Result<DashboardStats, String> {
        let total_users: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM unified_users")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let active_refresh_tokens: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM unified_refresh_tokens WHERE expires_at > NOW()",
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(DashboardStats {
            total_users,
            active_refresh_tokens,
        })
    }

    pub async fn get_recent_activity(&self, limit: i64) -> Result<Vec<ActivityEntry>, String> {
        let users =
            sqlx::query_as::<_, User>("SELECT * FROM unified_users ORDER BY created_at DESC LIMIT $1")
                .bind(limit)
                .fetch_all(&self.pool)
                .await
                .map_err(|e| e.to_string())?;

        Ok(users
            .into_iter()
            .map(|u| ActivityEntry {
                id: u.id.to_string(),
                username: u.username,
                email: u.email.unwrap_or_default(),
                created_at: u.created_at.to_rfc3339(),
            })
            .collect())
    }

    pub async fn get_admin_stats(&self) -> Result<AdminDashboardStats, String> {
        let now = Utc::now();
        let last_month = now - Duration::days(30);

        // 1. Total Users
        let total_users: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM unified_users")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        let users_last_month: i64 =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM unified_users WHERE created_at < $1")
                .bind(last_month)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| e.to_string())?;

        let user_growth = if users_last_month > 0 {
            ((total_users - users_last_month) as f64 / users_last_month as f64) * 100.0
        } else {
            100.0
        };

        // 2. Active Roles
        let role_class_id: uuid::Uuid = sqlx::query_scalar("SELECT id FROM classes WHERE name = 'Role' LIMIT 1")
            .fetch_one(&self.pool).await.map_err(|e| e.to_string())?;

        let active_roles: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM entities WHERE class_id = $1 AND deleted_at IS NULL")
            .bind(role_class_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        let roles_last_month: i64 =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM entities WHERE class_id = $1 AND created_at < $2 AND deleted_at IS NULL")
                .bind(role_class_id)
                .bind(last_month)
                .fetch_one(&self.pool)
                .await
                .map_err(|e| e.to_string())?;
        let role_growth = if roles_last_month > 0 {
            ((active_roles - roles_last_month) as f64 / roles_last_month as f64) * 100.0
        } else {
            0.0
        };

        // 3. Ontology Classes
        let ontology_classes: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM classes WHERE is_deprecated = FALSE",
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        let classes_last_month: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM classes WHERE created_at < $1 AND is_deprecated = FALSE",
        )
        .bind(last_month)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        let class_growth = if classes_last_month > 0 {
            ((ontology_classes - classes_last_month) as f64 / classes_last_month as f64) * 100.0
        } else {
            0.0
        };

        // 4. Policy Denials (Audit Logs with action 'ACCESS_DENIED')
        let policy_denials: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM unified_audit_logs WHERE action = 'ACCESS_DENIED' AND created_at > $1",
        )
        .bind(last_month)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let two_months_ago = now - Duration::days(60);
        let prev_denials: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM unified_audit_logs WHERE action = 'ACCESS_DENIED' AND created_at BETWEEN $1 AND $2")
             .bind(two_months_ago)
             .bind(last_month)
             .fetch_one(&self.pool).await.map_err(|e| e.to_string())?;

        let denial_growth = if prev_denials > 0 {
            ((policy_denials - prev_denials) as f64 / prev_denials as f64) * 100.0
        } else if policy_denials > 0 {
            100.0
        } else {
            0.0
        };

        let access_history = sqlx::query(
            r#"
            SELECT 
                DATE(created_at) as day,
                COUNT(*) FILTER (WHERE action = 'ACCESS_GRANTED' OR action = 'ACCESS_ALLOWED') as granted,
                COUNT(*) FILTER (WHERE action = 'ACCESS_DENIED') as denied
            FROM unified_audit_logs
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
            "#
        ).fetch_all(&self.pool).await.map_err(|e| e.to_string())?;

        let mut traffic = Vec::new();

        for row in access_history {
            let day: chrono::NaiveDate = row.get("day");
            let day_name = day.weekday().to_string();
            let granted: i64 = row.get("granted");
            let denied: i64 = row.get("denied");

            traffic.push(AccessTrafficPoint {
                name: day_name[0..3].to_string(),
                access: granted,
                denies: denied,
            });
        }

        Ok(AdminDashboardStats {
            total_users,
            user_growth,
            active_roles,
            role_growth,
            ontology_classes,
            class_growth,
            policy_denials,
            denial_growth,
            access_traffic: traffic,
        })
    }
}
