
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::{Pool, Postgres, Row};

#[derive(Debug, Serialize, Deserialize)]
pub struct ImpactReport {
    pub affected_users_count: usize,
    pub gained_access: Vec<UserImpact>,
    pub lost_access: Vec<UserImpact>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserImpact {
    pub user_id: Uuid,
    pub display_name: Option<String>, // if we can fetch it
    pub email: Option<String>,
    pub details: String,
}

#[derive(Debug, Deserialize)]
pub struct SimulateRoleChangeInput {
    pub role_id: Uuid,
    pub added_permissions: Vec<String>,
    pub removed_permissions: Vec<String>,
}

#[derive(Clone)]
pub struct ImpactService {
    pool: Pool<Postgres>,
}

impl ImpactService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    /// Simulate adding/removing permissions from a role
    pub async fn simulate_role_change(&self, input: SimulateRoleChangeInput) -> Result<ImpactReport, sqlx::Error> {
        let mut report = ImpactReport {
            affected_users_count: 0,
            gained_access: vec![],
            lost_access: vec![],
        };

        // 1. Identify all users who hold this role (Global or Scoped)
        // We only care about users who *currently* have this role, as they are the ones affected
        // Query to get distinct users with this role
        let users = sqlx::query(
            r#"
            SELECT DISTINCT u.id, u.email, u.username
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN scoped_user_roles sur ON u.id = sur.user_id
            WHERE (ur.role_id = $1) OR (sur.role_id = $1 AND sur.revoked_at IS NULL)
            "#
        )
        .bind(input.role_id)
        .fetch_all(&self.pool)
        .await?;

        // 2. For each user, check the impact
        // Optimization: For "Added" permissions, everyone with the role gains them (unless they already had them)
        // For "Removed" permissions, they lose them unless they have them from another role.
        
        
        for user_row in users {
            let user_row_id: Uuid = user_row.get("id");
            let user_email: String = user_row.get("email");
            let user_username: String = user_row.get("username");
            
            // Check LOST access
            for perm in &input.removed_permissions {
                // Check if user has this permission from ANY OTHER role
                // We exclude the current role_id from the check
                let has_alternative: bool = sqlx::query_scalar(
                    r#"
                    SELECT EXISTS (
                        SELECT 1
                        FROM (
                            -- Global Roles
                            SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = $1 AND ur.role_id != $2
                            UNION
                            -- Scoped Roles
                            SELECT sur.role_id FROM scoped_user_roles sur WHERE sur.user_id = $1 AND sur.role_id != $2 AND sur.revoked_at IS NULL
                        ) as user_roles_combined
                        JOIN role_permission_types rpt ON user_roles_combined.role_id = rpt.role_id
                        JOIN permission_types pt ON rpt.permission_type_id = pt.id
                        WHERE pt.name = $3
                    )
                    "#
                )
                .bind(user_row_id)
                .bind(input.role_id)
                .bind(perm)
                .fetch_one(&self.pool)
                .await?;


                if !has_alternative {
                    report.lost_access.push(UserImpact {
                        user_id: user_row_id,
                        email: Some(user_email.clone()),
                        display_name: Some(user_username.clone()),
                        details: format!("Loses permission '{}'", perm),
                    });
                }
            }
            
            // Check GAINED access
            for perm in &input.added_permissions {
                let had_it_before: bool = sqlx::query_scalar(
                    r#"
                    SELECT EXISTS (
                        SELECT 1
                        FROM (
                             -- Global Roles
                            SELECT ur.role_id FROM user_roles ur WHERE ur.user_id = $1
                            UNION
                             -- Scoped Roles
                            SELECT sur.role_id FROM scoped_user_roles sur WHERE sur.user_id = $1 AND sur.revoked_at IS NULL
                        ) as user_roles_combined
                        JOIN role_permission_types rpt ON user_roles_combined.role_id = rpt.role_id
                        JOIN permission_types pt ON rpt.permission_type_id = pt.id
                        WHERE pt.name = $2
                    )
                    "#
                )
                .bind(user_row_id)
                .bind(perm)
                .fetch_one(&self.pool)
                .await?;


                if !had_it_before {
                    report.gained_access.push(UserImpact {
                        user_id: user_row_id,
                        email: Some(user_email.clone()),
                        display_name: Some(user_username.clone()),
                        details: format!("Gains permission '{}'", perm),
                    });
                }
            }
        }

        report.affected_users_count = report.gained_access.len() + report.lost_access.len();
        
        Ok(report)
    }
}
