use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
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
        let existing = sqlx::query(
            "SELECT is_enabled FROM user_mfa WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = existing {
            let is_enabled: bool = row.get("is_enabled");
            if is_enabled {
                return Err(MfaError::AlreadyEnabled);
            }
            // Delete existing non-enabled setup to allow re-setup
            sqlx::query("DELETE FROM user_mfa WHERE user_id = $1")
                .bind(user_id)
                .execute(&self.pool)
                .await?;
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

        // Store in database
        sqlx::query(
            r#"
            INSERT INTO user_mfa (user_id, secret_key, backup_codes, backup_codes_remaining)
            VALUES ($1, $2, $3, $4)
            "#
        )
        .bind(user_id)
        .bind(&secret_base32)
        .bind(&hashed_codes)
        .bind(backup_codes.len() as i32)
        .execute(&self.pool)
        .await?;

        Ok(MfaSetupResponse {
            secret: secret_base32,
            qr_code_url,
            backup_codes,
        })
    }

    /// Verify TOTP code and enable MFA
    pub async fn verify_setup(&self, user_id: Uuid, code: &str) -> Result<(), MfaError> {
        let row = sqlx::query(
            "SELECT secret_key, is_enabled FROM user_mfa WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        let is_enabled: bool = row.get("is_enabled");
        if is_enabled {
            return Err(MfaError::AlreadyEnabled);
        }

        let secret_key: String = row.get("secret_key");
        
        if !self.verify_totp(&secret_key, code)? {
            return Err(MfaError::InvalidCode);
        }

        // Enable MFA
        sqlx::query(
            r#"
            UPDATE user_mfa 
            SET is_enabled = TRUE, is_verified = TRUE, enabled_at = NOW(), updated_at = NOW()
            WHERE user_id = $1
            "#
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Verify TOTP code during login
    pub async fn verify_code(&self, user_id: Uuid, code: &str) -> Result<(), MfaError> {
        let row = sqlx::query(
            "SELECT secret_key, is_enabled, is_verified FROM user_mfa WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        let is_enabled: bool = row.get("is_enabled");
        let is_verified: bool = row.get("is_verified");

        if !is_enabled || !is_verified {
            return Err(MfaError::NotEnabled);
        }

        let secret_key: String = row.get("secret_key");
        
        if !self.verify_totp(&secret_key, code)? {
            return Err(MfaError::InvalidCode);
        }

        // Update last_used_at
        sqlx::query(
            "UPDATE user_mfa SET last_used_at = NOW(), updated_at = NOW() WHERE user_id = $1"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Verify backup code during login (single use)
    pub async fn verify_backup_code(&self, user_id: Uuid, code: &str) -> Result<(), MfaError> {
        let row = sqlx::query(
            "SELECT backup_codes, backup_codes_remaining, is_enabled FROM user_mfa WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        let is_enabled: bool = row.get("is_enabled");
        if !is_enabled {
            return Err(MfaError::NotEnabled);
        }

        let remaining: i32 = row.get("backup_codes_remaining");
        if remaining == 0 {
            return Err(MfaError::NoBackupCodes);
        }

        let backup_codes: Vec<String> = row.get("backup_codes");
        let code_hash = hash_backup_code(code);

        // Find and remove the matching code
        let mut found_index: Option<usize> = None;
        for (i, stored_hash) in backup_codes.iter().enumerate() {
            if stored_hash == &code_hash {
                found_index = Some(i);
                break;
            }
        }

        let idx = found_index.ok_or(MfaError::InvalidBackupCode)?;

        // Remove the used code
        let mut new_codes = backup_codes;
        new_codes.remove(idx);

        sqlx::query(
            r#"
            UPDATE user_mfa 
            SET backup_codes = $2, backup_codes_remaining = backup_codes_remaining - 1, 
                last_used_at = NOW(), updated_at = NOW()
            WHERE user_id = $1
            "#
        )
        .bind(user_id)
        .bind(&new_codes)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Disable MFA for user
    pub async fn disable_mfa(&self, user_id: Uuid) -> Result<(), MfaError> {
        let result = sqlx::query(
            "DELETE FROM user_mfa WHERE user_id = $1 AND is_enabled = TRUE"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(MfaError::NotEnabled);
        }

        Ok(())
    }

    /// Regenerate backup codes
    pub async fn regenerate_backup_codes(&self, user_id: Uuid) -> Result<Vec<String>, MfaError> {
        let row = sqlx::query(
            "SELECT is_enabled FROM user_mfa WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or(MfaError::MfaNotFound)?;

        let is_enabled: bool = row.get("is_enabled");
        if !is_enabled {
            return Err(MfaError::NotEnabled);
        }

        // Generate new backup codes
        let backup_codes: Vec<String> = (0..8)
            .map(|_| generate_backup_code())
            .collect();

        let hashed_codes: Vec<String> = backup_codes.iter()
            .map(|code| hash_backup_code(code))
            .collect();

        sqlx::query(
            r#"
            UPDATE user_mfa 
            SET backup_codes = $2, backup_codes_remaining = $3, updated_at = NOW()
            WHERE user_id = $1
            "#
        )
        .bind(user_id)
        .bind(&hashed_codes)
        .bind(backup_codes.len() as i32)
        .execute(&self.pool)
        .await?;

        Ok(backup_codes)
    }

    /// Get MFA status for user
    pub async fn get_status(&self, user_id: Uuid) -> Result<MfaStatus, MfaError> {
        let row = sqlx::query(
            r#"
            SELECT is_enabled, is_verified, backup_codes_remaining, last_used_at 
            FROM user_mfa WHERE user_id = $1
            "#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(r) => Ok(MfaStatus {
                is_enabled: r.get("is_enabled"),
                is_verified: r.get("is_verified"),
                backup_codes_remaining: r.get("backup_codes_remaining"),
                last_used_at: r.get("last_used_at"),
            }),
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
        let row = sqlx::query(
            "SELECT is_enabled AND is_verified as required FROM user_mfa WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| r.get::<bool, _>("required")).unwrap_or(false))
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
