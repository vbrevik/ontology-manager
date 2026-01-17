use sha2::{Digest, Sha256};
use sqlx::PgPool;
use chrono::Utc;
use thiserror::Error;
use totp_rs::{Algorithm, Secret, TOTP};
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum MfaError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("MFA not found for user")]
    MfaNotFound,

    #[error("MFA already enabled")]
    AlreadyEnabled,

    #[error("MFA not enabled")]
    NotEnabled,

    #[error("Invalid TOTP code")]
    InvalidCode,

    #[error("Invalid backup code")]
    InvalidBackupCode,

    #[error("No backup codes remaining")]
    NoBackupCodes,

    #[error("MFA setup not verified")]
    NotVerified,

    #[error("TOTP generation error: {0}")]
    TotpError(String),
}

impl MfaError {
    pub fn to_status_code(&self) -> axum::http::StatusCode {
        use axum::http::StatusCode;
        match self {
            MfaError::MfaNotFound => StatusCode::NOT_FOUND,
            MfaError::AlreadyEnabled => StatusCode::CONFLICT,
            MfaError::NotEnabled => StatusCode::BAD_REQUEST,
            MfaError::InvalidCode | MfaError::InvalidBackupCode => StatusCode::UNAUTHORIZED,
            MfaError::NoBackupCodes => StatusCode::GONE,
            MfaError::NotVerified => StatusCode::PRECONDITION_FAILED,
            MfaError::DatabaseError(_) | MfaError::TotpError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Clone)]
pub struct MfaService {
    pool: PgPool,
    issuer: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MfaSetupResponse {
    pub secret: String,
    pub qr_code_url: String,
    pub backup_codes: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MfaStatus {
    pub is_enabled: bool,
    pub is_verified: bool,
    pub backup_codes_remaining: i32,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl MfaService {
    pub fn new(pool: PgPool, issuer: String) -> Self {
        Self { pool, issuer }
    }

    /// Generate a new TOTP secret and backup codes for user
    pub async fn setup_mfa(&self, user_id: Uuid, email: &str) -> Result<MfaSetupResponse, MfaError> {
        // Check if MFA already exists and is enabled
        let user = sqlx::query!(
            "SELECT mfa_enabled FROM unified_users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        if user.mfa_enabled.unwrap_or(false) {
            return Err(MfaError::AlreadyEnabled);
        }

        // Generate TOTP secret
        let secret = Secret::generate_secret();
        let secret_base32 = secret.to_encoded().to_string();

        let totp = TOTP::new(
            Algorithm::SHA1,
            6,
            1,
            30,
            secret.to_bytes().map_err(|e| MfaError::TotpError(e.to_string()))?,
            Some(self.issuer.clone()),
            email.to_string(),
        ).map_err(|e| MfaError::TotpError(e.to_string()))?;

        let qr_code_url = totp.get_url();

        // Generate 8 backup codes
        let backup_codes: Vec<String> = (0..8)
            .map(|_| generate_backup_code())
            .collect();

        // Hash backup codes for storage
        let hashed_codes: Vec<String> = backup_codes.iter()
            .map(|code| hash_backup_code(code))
            .collect();

        // Store in ontology
        self.update_mfa_attributes(user_id, serde_json::json!({
            "mfa_secret": secret_base32,
            "backup_codes": hashed_codes,
            "mfa_enabled": false,
            "mfa_verified": false
        })).await?;

        Ok(MfaSetupResponse {
            secret: secret_base32,
            qr_code_url,
            backup_codes,
        })
    }

    /// Verify TOTP code and enable MFA
    pub async fn verify_setup(&self, user_id: Uuid, code: &str) -> Result<(), MfaError> {
        let user = sqlx::query!(
            "SELECT mfa_secret, mfa_enabled FROM unified_users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        if user.mfa_enabled.unwrap_or(false) {
            return Err(MfaError::AlreadyEnabled);
        }

        let secret_key = user.mfa_secret.ok_or(MfaError::NotEnabled)?;
        
        if !self.verify_totp(&secret_key, code)? {
            return Err(MfaError::InvalidCode);
        }

        // Enable MFA
        self.update_mfa_attributes(user_id, serde_json::json!({
            "mfa_enabled": true,
            "mfa_verified": true,
            "mfa_enabled_at": Utc::now()
        })).await?;

        Ok(())
    }

    /// Verify TOTP code during login
    pub async fn verify_code(&self, user_id: Uuid, code: &str) -> Result<(), MfaError> {
        let user = sqlx::query!(
            "SELECT mfa_secret, mfa_enabled, mfa_verified FROM unified_users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        if !user.mfa_enabled.unwrap_or(false) || !user.mfa_verified.unwrap_or(false) {
            return Err(MfaError::NotEnabled);
        }

        let secret_key = user.mfa_secret.ok_or(MfaError::NotEnabled)?;
        
        if !self.verify_totp(&secret_key, code)? {
            return Err(MfaError::InvalidCode);
        }

        // Update last_used_at
        self.update_mfa_attributes(user_id, serde_json::json!({
            "mfa_last_used_at": Utc::now()
        })).await?;

        Ok(())
    }

    /// Verify backup code during login (single use)
    pub async fn verify_backup_code(&self, user_id: Uuid, code: &str) -> Result<(), MfaError> {
        let user = sqlx::query!(
            "SELECT backup_codes, mfa_enabled FROM unified_users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        if !user.mfa_enabled.unwrap_or(false) {
            return Err(MfaError::NotEnabled);
        }

        let backup_codes: Vec<String> = serde_json::from_value(user.backup_codes.unwrap_or(serde_json::json!([])))
            .map_err(|_| MfaError::DatabaseError(sqlx::Error::Protocol("Invalid backup codes format".to_string())))?;

        if backup_codes.is_empty() {
            return Err(MfaError::NoBackupCodes);
        }

        let code_hash = hash_backup_code(code);

        // Find and remove the matching code
        let mut new_codes = backup_codes;
        let original_len = new_codes.len();
        new_codes.retain(|stored_hash| stored_hash != &code_hash);

        if new_codes.len() == original_len {
            return Err(MfaError::InvalidBackupCode);
        }

        self.update_mfa_attributes(user_id, serde_json::json!({
            "backup_codes": new_codes,
            "mfa_last_used_at": Utc::now()
        })).await?;

        Ok(())
    }

    /// Disable MFA for user
    pub async fn disable_mfa(&self, user_id: Uuid) -> Result<(), MfaError> {
        let user = sqlx::query!(
            "SELECT mfa_enabled FROM unified_users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        if !user.mfa_enabled.unwrap_or(false) {
            return Err(MfaError::NotEnabled);
        }

        sqlx::query(
            "UPDATE entities SET attributes = attributes - 'mfa_secret' - 'backup_codes' - 'mfa_enabled' - 'mfa_verified' - 'mfa_last_used_at' WHERE id = $1"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Regenerate backup codes
    pub async fn regenerate_backup_codes(&self, user_id: Uuid) -> Result<Vec<String>, MfaError> {
        let user = sqlx::query!(
            "SELECT mfa_enabled FROM unified_users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        if !user.mfa_enabled.unwrap_or(false) {
            return Err(MfaError::NotEnabled);
        }

        // Generate new backup codes
        let backup_codes: Vec<String> = (0..8)
            .map(|_| generate_backup_code())
            .collect();

        let hashed_codes: Vec<String> = backup_codes.iter()
            .map(|code| hash_backup_code(code))
            .collect();

        self.update_mfa_attributes(user_id, serde_json::json!({
            "backup_codes": hashed_codes
        })).await?;

        Ok(backup_codes)
    }

    /// Get MFA status for user
    pub async fn get_status(&self, user_id: Uuid) -> Result<MfaStatus, MfaError> {
        let user = sqlx::query!(
            "SELECT mfa_enabled, mfa_verified, backup_codes, mfa_last_used_at FROM unified_users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        match user {
            Some(u) => {
                let codes: Vec<String> = serde_json::from_value(u.backup_codes.unwrap_or(serde_json::json!([]))).unwrap_or_default();
                Ok(MfaStatus {
                    is_enabled: u.mfa_enabled.unwrap_or(false),
                    is_verified: u.mfa_verified.unwrap_or(false),
                    backup_codes_remaining: codes.len() as i32,
                    last_used_at: u.mfa_last_used_at,
                })
            },
            None => Ok(MfaStatus {
                is_enabled: false,
                is_verified: false,
                backup_codes_remaining: 0,
                last_used_at: None,
            }),
        }
    }

    /// Check if MFA is required for user
    pub async fn is_mfa_required(&self, user_id: Uuid) -> Result<bool, MfaError> {
        let user = sqlx::query!(
            "SELECT mfa_enabled, mfa_verified FROM unified_users WHERE id = $1",
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(user.map(|u| u.mfa_enabled.unwrap_or(false) && u.mfa_verified.unwrap_or(false)).unwrap_or(false))
    }

    async fn update_mfa_attributes(&self, user_id: Uuid, attributes: serde_json::Value) -> Result<(), MfaError> {
        sqlx::query(
            "UPDATE entities SET attributes = attributes || $1, updated_at = NOW() WHERE id = $2"
        )
        .bind(attributes)
        .bind(user_id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    fn verify_totp(&self, secret_base32: &str, code: &str) -> Result<bool, MfaError> {
        let secret = Secret::Encoded(secret_base32.to_string());
        let totp = TOTP::new(
            Algorithm::SHA1,
            6,
            1,
            30,
            secret.to_bytes().map_err(|e| MfaError::TotpError(e.to_string()))?,
            Some(self.issuer.clone()),
            String::new(), // account name not needed for verification
        ).map_err(|e| MfaError::TotpError(e.to_string()))?;

        Ok(totp.check_current(code).unwrap_or(false))
    }
}

/// Generate a random 8-character backup code
fn generate_backup_code() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let code: String = (0..8)
        .map(|_| rng.sample(rand::distributions::Alphanumeric) as char)
        .collect();
    code.to_uppercase()
}

/// Hash backup code for secure storage
fn hash_backup_code(code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code.to_uppercase().as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backup_code_generation() {
        let code = generate_backup_code();
        assert_eq!(code.len(), 8);
        assert!(code.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn test_backup_code_hashing() {
        let code = "ABCD1234";
        let hash1 = hash_backup_code(code);
        let hash2 = hash_backup_code(code);
        assert_eq!(hash1, hash2);
        
        // Case insensitive
        let hash3 = hash_backup_code("abcd1234");
        assert_eq!(hash1, hash3);
    }
}
