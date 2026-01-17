use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres, Row};
use uuid::Uuid;

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
    pub async fn simulate_role_change(
        &self,
        input: SimulateRoleChangeInput,
    ) -> Result<ImpactReport, sqlx::Error> {
        let mut report = ImpactReport {
            affected_users_count: 0,
            gained_access: vec![],
            lost_access: vec![],
        };

        // 1. Identify all users who hold this role via 'has_role' relationships
        let users = sqlx::query(
            r#"
            SELECT DISTINCT u.id, u.email, u.username
            FROM unified_users u
            JOIN relationships r ON u.id = r.source_entity_id
            WHERE r.target_entity_id = $1 
              AND r.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_role')
              -- Check temporal validity if metadata exists
              AND (
                (r.metadata->>'valid_from') IS NULL OR 
                (r.metadata->>'valid_from')::timestamptz <= NOW()
              )
              AND (
                (r.metadata->>'valid_until') IS NULL OR 
                (r.metadata->>'valid_until')::timestamptz >= NOW()
              )
            "#,
        )
        .bind(input.role_id)
        .fetch_all(&self.pool)
        .await?;

        for user_row in users {
            let user_row_id: Uuid = user_row.get("id");
            let user_email: String = user_row.get("email");
            let user_username: String = user_row.get("username");

            // Check LOST access
            for perm in &input.removed_permissions {
                let has_alternative: bool = sqlx::query_scalar(
                    r#"
                    SELECT EXISTS (
                        SELECT 1
                        FROM relationships r_has_role
                        JOIN relationships r_grant ON r_has_role.target_entity_id = r_grant.source_entity_id
                        JOIN entities e_perm ON r_grant.target_entity_id = e_perm.id
                        WHERE r_has_role.source_entity_id = $1
                          AND r_has_role.target_entity_id != $2
                          AND r_has_role.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_role')
                          AND r_grant.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'grants_permission')
                          AND e_perm.display_name = $3
                          -- Check temporal validity
                          AND (
                            (r_has_role.metadata->>'valid_from') IS NULL OR 
                            (r_has_role.metadata->>'valid_from')::timestamptz <= NOW()
                          )
                          AND (
                            (r_has_role.metadata->>'valid_until') IS NULL OR 
                            (r_has_role.metadata->>'valid_until')::timestamptz >= NOW()
                          )
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
                        FROM relationships r_has_role
                        JOIN relationships r_grant ON r_has_role.target_entity_id = r_grant.source_entity_id
                        JOIN entities e_perm ON r_grant.target_entity_id = e_perm.id
                        WHERE r_has_role.source_entity_id = $1
                          AND r_has_role.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'has_role')
                          AND r_grant.relationship_type_id = (SELECT id FROM relationship_types WHERE name = 'grants_permission')
                          AND e_perm.display_name = $2
                          -- Check temporal validity
                          AND (
                            (r_has_role.metadata->>'valid_from') IS NULL OR 
                            (r_has_role.metadata->>'valid_from')::timestamptz <= NOW()
                          )
                          AND (
                            (r_has_role.metadata->>'valid_until') IS NULL OR 
                            (r_has_role.metadata->>'valid_until')::timestamptz >= NOW()
                          )
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
