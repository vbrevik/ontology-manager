use sqlx::PgPool;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum TestMarkerError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    #[error("Test marker infrastructure not found")]
    InfrastructureNotFound,
}

#[derive(Clone)]
pub struct TestMarkerService {
    pool: PgPool,
}

impl TestMarkerService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Mark an entity as test data
    pub async fn mark_as_test_data(
        &self,
        entity_id: Uuid,
        test_suite: &str,
        test_name: Option<&str>,
    ) -> Result<(), TestMarkerError> {
        sqlx::query(
            "SELECT mark_as_test_data($1, $2, $3)"
        )
        .bind(entity_id)
        .bind(test_suite)
        .bind(test_name)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Check if an entity is marked as test data
    pub async fn is_test_data(&self, entity_id: Uuid) -> Result<bool, TestMarkerError> {
        let is_test = sqlx::query_scalar::<_, bool>(
            "SELECT is_test_data($1)"
        )
        .bind(entity_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(is_test)
    }

    /// Clean up old test data
    pub async fn cleanup_expired_test_data(&self, days_old: i32) -> Result<Vec<Uuid>, TestMarkerError> {
        let deleted_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT deleted_entity_id FROM cleanup_expired_test_data($1)"
        )
        .bind(days_old)
        .fetch_all(&self.pool)
        .await?;

        Ok(deleted_ids)
    }

    /// Get all test entities of a specific class
    pub async fn get_test_entities(&self, class_name: &str) -> Result<Vec<Uuid>, TestMarkerError> {
        let entity_ids = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT e.id
            FROM entities e
            WHERE e.class_id = (SELECT id FROM classes WHERE name = $1)
            AND e.deleted_at IS NULL
            AND is_test_data(e.id)
            "#
        )
        .bind(class_name)
        .fetch_all(&self.pool)
        .await?;

        Ok(entity_ids)
    }
}
