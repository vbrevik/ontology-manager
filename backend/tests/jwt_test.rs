mod jwt_helpers;
use chrono::{Duration, Utc};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use template_repo_backend::features::auth::jwt::{
    create_jwt, create_refresh_token, validate_jwt, UserRoleClaim,
};

static KEY_FILE_LOCK: Mutex<()> = Mutex::new(());

struct CwdGuard {
    original: PathBuf,
}

impl CwdGuard {
    fn set(target: &Path) -> Self {
        let original = std::env::current_dir().expect("current dir should be readable");
        std::env::set_current_dir(target).expect("set_current_dir should succeed");
        Self { original }
    }
}

impl Drop for CwdGuard {
    fn drop(&mut self) {
        let _ = std::env::set_current_dir(&self.original);
    }
}

struct TempDirGuard {
    path: PathBuf,
}

impl TempDirGuard {
    fn new(prefix: &str) -> Self {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be valid")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{}_{}", prefix, nanos));
        fs::create_dir_all(&path).expect("temp dir should be created");
        Self { path }
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

struct KeyFilesGuard {
    private_path: PathBuf,
    public_path: PathBuf,
    prev_private: Option<String>,
    prev_public: Option<String>,
}

impl KeyFilesGuard {
    fn write(dir: &Path, private_pem: &str, public_pem: &str) -> Self {
        let keys_dir = dir.join("keys");
        fs::create_dir_all(&keys_dir).expect("keys dir should exist");
        let private_path = keys_dir.join("private_key.pem");
        let public_path = keys_dir.join("public_key.pem");
        let prev_private = fs::read_to_string(&private_path).ok();
        let prev_public = fs::read_to_string(&public_path).ok();

        fs::write(&private_path, private_pem).expect("write private key");
        fs::write(&public_path, public_pem).expect("write public key");

        Self {
            private_path,
            public_path,
            prev_private,
            prev_public,
        }
    }
}

impl Drop for KeyFilesGuard {
    fn drop(&mut self) {
        match &self.prev_private {
            Some(contents) => {
                let _ = fs::write(&self.private_path, contents);
            }
            None => {
                let _ = fs::remove_file(&self.private_path);
            }
        }

        match &self.prev_public {
            Some(contents) => {
                let _ = fs::write(&self.public_path, contents);
            }
            None => {
                let _ = fs::remove_file(&self.public_path);
            }
        }
    }
}

#[test]
fn test_create_jwt_valid_token() {
    let config = jwt_helpers::create_test_config();
    let roles = vec![UserRoleClaim {
        role_name: "admin".to_string(),
        resource_id: None,
    }];
    let permissions = vec!["read".to_string(), "write".to_string()];

    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        roles.clone(),
        permissions.clone(),
        &config,
    );

    assert!(token.is_ok(), "Token creation should succeed");
    let token_str = token.unwrap();
    assert!(!token_str.is_empty(), "Token should not be empty");

    let claims = validate_jwt(&token_str, &config);
    assert!(claims.is_ok(), "Token should be valid");
    let parsed_claims = claims.unwrap();
    assert_eq!(parsed_claims.sub, "user123");
    assert_eq!(parsed_claims.username, "testuser");
    assert_eq!(parsed_claims.email, "test@example.com");
    assert_eq!(parsed_claims.roles, roles);
    assert_eq!(parsed_claims.permissions, permissions);
    assert!(
        parsed_claims.jti.is_none(),
        "Access token should not have JTI"
    );
}

#[test]
fn test_create_jwt_expiration_time() {
    let config = jwt_helpers::create_test_config();
    let now = Utc::now();

    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    );

    assert!(token.is_ok());
    let token_str = token.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    let expected_exp = (now + Duration::seconds(config.jwt_expiry)).timestamp();
    let exp_diff = (claims.exp - expected_exp).abs();
    assert!(
        exp_diff <= 2,
        "Expiration time should be within 2 seconds of expected. Got diff: {}",
        exp_diff
    );
}

#[test]
fn test_create_jwt_with_roles_and_permissions() {
    let config = jwt_helpers::create_test_config();
    let roles = vec![
        UserRoleClaim {
            role_name: "editor".to_string(),
            resource_id: Some("resource1".to_string()),
        },
        UserRoleClaim {
            role_name: "viewer".to_string(),
            resource_id: None,
        },
    ];
    let permissions = vec![
        "read".to_string(),
        "write".to_string(),
        "delete".to_string(),
    ];

    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        roles.clone(),
        permissions.clone(),
        &config,
    );

    assert!(token.is_ok());
    let token_str = token.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    assert_eq!(claims.roles.len(), 2);
    assert_eq!(claims.roles[0].role_name, "editor");
    assert_eq!(claims.roles[0].resource_id, Some("resource1".to_string()));
    assert_eq!(claims.roles[1].role_name, "viewer");
    assert_eq!(claims.permissions, permissions);
}

#[test]
fn test_create_jwt_empty_roles_and_permissions() {
    let config = jwt_helpers::create_test_config();
    let roles: Vec<UserRoleClaim> = vec![];
    let permissions: Vec<String> = vec![];

    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        roles,
        permissions,
        &config,
    );

    assert!(token.is_ok());
    let token_str = token.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    assert!(claims.roles.is_empty());
    assert!(claims.permissions.is_empty());
}

#[test]
fn test_create_refresh_token_with_jti() {
    let config = jwt_helpers::create_test_config();
    let roles = vec![UserRoleClaim {
        role_name: "admin".to_string(),
        resource_id: None,
    }];
    let permissions = vec!["read".to_string()];

    let result = create_refresh_token(
        "user123",
        "testuser",
        "test@example.com",
        roles,
        permissions,
        &config,
    );

    assert!(result.is_ok(), "Refresh token creation should succeed");
    let (token_str, jti) = result.unwrap();
    assert!(!token_str.is_empty(), "Token should not be empty");
    assert!(!jti.is_empty(), "JTI should not be empty");

    let claims = validate_jwt(&token_str, &config).unwrap();
    assert_eq!(claims.jti, Some(jti), "Token JTI should match returned JTI");
}

#[test]
fn test_create_refresh_token_longer_expiration() {
    let config = jwt_helpers::create_test_config();
    let now = Utc::now();

    let result = create_refresh_token(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    );

    assert!(result.is_ok());
    let (token_str, _) = result.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    let expected_exp = (now + Duration::seconds(config.refresh_token_expiry)).timestamp();
    let exp_diff = (claims.exp - expected_exp).abs();
    assert!(
        exp_diff <= 2,
        "Refresh token expiration should be within 2 seconds of expected. Got diff: {}",
        exp_diff
    );
}

#[test]
fn test_create_refresh_token_jti_uniqueness() {
    let config = jwt_helpers::create_test_config();

    let (_, jti1) = create_refresh_token(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();
    let (_, jti2) = create_refresh_token(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();
    let (_, jti3) = create_refresh_token(
        "user456",
        "anotheruser",
        "another@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();

    assert_ne!(jti1, jti2, "JTIs from same user should be different");
    assert_ne!(jti1, jti3, "JTIs from different users should be different");
    assert_ne!(jti2, jti3, "All JTIs should be unique");
}

#[test]
fn test_create_refresh_token_includes_roles_and_permissions() {
    let config = jwt_helpers::create_test_config();
    let roles = vec![UserRoleClaim {
        role_name: "admin".to_string(),
        resource_id: None,
    }];
    let permissions = vec!["read".to_string(), "write".to_string()];

    let result = create_refresh_token(
        "user123",
        "testuser",
        "test@example.com",
        roles.clone(),
        permissions.clone(),
        &config,
    );
    assert!(result.is_ok());
    let (token_str, jti) = result.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    assert_eq!(claims.jti, Some(jti));
    assert_eq!(claims.roles, roles);
    assert_eq!(claims.permissions, permissions);
}

#[test]
fn test_validate_jwt_success() {
    let config = jwt_helpers::create_test_config();
    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();

    let result = validate_jwt(&token, &config);

    assert!(result.is_ok(), "Valid token should be accepted");
    let claims = result.unwrap();
    assert_eq!(claims.sub, "user123");
    assert_eq!(claims.username, "testuser");
    assert_eq!(claims.email, "test@example.com");
}

#[test]
fn test_validate_jwt_expired() {
    let mut config = jwt_helpers::create_test_config();
    config.jwt_expiry = -3600;
    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();
    let result = validate_jwt(&token, &config);
    assert!(result.is_err(), "Expired token should be rejected");
}

#[test]
fn test_validate_jwt_invalid_signature() {
    let config = jwt_helpers::create_test_config();
    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();

    let tampered_token = token.as_bytes().to_vec();
    let mut tampered_token_bytes = tampered_token;
    if let Some(byte) = tampered_token_bytes.get_mut(50) {
        *byte = byte.wrapping_add(1);
    }
    let tampered_str = String::from_utf8(tampered_token_bytes).unwrap_or_else(|_| token.clone());

    let result = validate_jwt(&tampered_str, &config);

    assert!(
        result.is_err(),
        "Token with invalid signature should be rejected"
    );
}

#[test]
fn test_validate_jwt_malformed() {
    let config = jwt_helpers::create_test_config();
    let malformed_tokens = vec![
        "",
        "not.a.jwt",
        "invalid.token.here",
        "a.b.c",
        "header.payload.signature.extra",
        "header.payload",
    ];

    for malformed_token in malformed_tokens {
        let result = validate_jwt(malformed_token, &config);
        assert!(
            result.is_err(),
            "Malformed token '{}' should be rejected",
            malformed_token
        );
    }
}

#[test]
fn test_validate_jwt_with_jti() {
    let config = jwt_helpers::create_test_config();
    let (token, jti) = create_refresh_token(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();

    let result = validate_jwt(&token, &config);

    assert!(result.is_ok());
    let claims = result.unwrap();
    assert_eq!(claims.jti, Some(jti));
}

#[test]
fn test_load_private_pem_from_config() {
    let config = jwt_helpers::create_test_config();

    assert!(
        !config.jwt_private_key.is_empty(),
        "Private key should be in config"
    );
    assert!(
        config.jwt_private_key.contains("BEGIN PRIVATE KEY"),
        "Config should contain PEM formatted key"
    );
}

#[test]
fn test_load_public_pem_from_config() {
    let config = jwt_helpers::create_test_config();

    assert!(
        !config.jwt_public_key.is_empty(),
        "Public key should be in config"
    );
    assert!(
        config.jwt_public_key.contains("BEGIN PUBLIC KEY"),
        "Config should contain PEM formatted key"
    );
}

#[test]
fn test_token_issued_at_time() {
    let config = jwt_helpers::create_test_config();
    let now = Utc::now();

    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    );

    assert!(token.is_ok());
    let token_str = token.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    let iat_diff = (claims.iat - now.timestamp()).abs();
    assert!(
        iat_diff <= 2,
        "Issued at time should be within 2 seconds of now. Got diff: {}",
        iat_diff
    );
}

#[test]
fn test_token_subject_encoding() {
    let config = jwt_helpers::create_test_config();
    let user_id = "user-with-special_chars_123";

    let token = create_jwt(
        user_id,
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    );

    assert!(token.is_ok());
    let token_str = token.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    assert_eq!(claims.sub, user_id);
}

#[test]
fn test_token_role_serialization() {
    let config = jwt_helpers::create_test_config();
    let roles = vec![UserRoleClaim {
        role_name: "complex-role_name".to_string(),
        resource_id: Some("resource-with-dashes_and_underscores".to_string()),
    }];

    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        roles.clone(),
        vec![],
        &config,
    );

    assert!(token.is_ok());
    let token_str = token.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    assert_eq!(claims.roles.len(), 1);
    assert_eq!(claims.roles[0].role_name, "complex-role_name");
    assert_eq!(
        claims.roles[0].resource_id,
        Some("resource-with-dashes_and_underscores".to_string())
    );
}

#[test]
fn test_token_permission_serialization() {
    let config = jwt_helpers::create_test_config();
    let permissions = vec![
        "resource:read".to_string(),
        "resource:write".to_string(),
        "resource:delete".to_string(),
        "admin:manage".to_string(),
    ];

    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        permissions.clone(),
        &config,
    );

    assert!(token.is_ok());
    let token_str = token.unwrap();
    let claims = validate_jwt(&token_str, &config).unwrap();

    assert_eq!(claims.permissions, permissions);
}

#[test]
fn test_multiple_validations_same_token() {
    let config = jwt_helpers::create_test_config();
    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();

    let result1 = validate_jwt(&token, &config);
    let result2 = validate_jwt(&token, &config);
    let result3 = validate_jwt(&token, &config);

    assert!(result1.is_ok());
    assert!(result2.is_ok());
    assert!(result3.is_ok());
}

#[test]
fn test_refresh_token_different_from_access_token() {
    let config = jwt_helpers::create_test_config();
    let roles = vec![UserRoleClaim {
        role_name: "admin".to_string(),
        resource_id: None,
    }];
    let permissions = vec!["read".to_string()];

    let access_token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        roles.clone(),
        permissions.clone(),
        &config,
    )
    .unwrap();
    let refresh_result = create_refresh_token(
        "user123",
        "testuser",
        "test@example.com",
        roles,
        permissions,
        &config,
    );
    assert!(refresh_result.is_ok());
    let (refresh_token, jti) = refresh_result.unwrap();

    assert_ne!(
        access_token, refresh_token,
        "Access and refresh tokens should be different"
    );

    let access_claims = validate_jwt(&access_token, &config).unwrap();
    let refresh_claims = validate_jwt(&refresh_token, &config).unwrap();

    assert!(
        access_claims.jti.is_none(),
        "Access token should not have JTI"
    );
    assert_eq!(
        refresh_claims.jti,
        Some(jti),
        "Refresh token should have JTI"
    );
}

#[test]
fn test_concurrent_token_creation() {
    let config = jwt_helpers::create_test_config();

    let handles: Vec<_> = (0..10)
        .map(|i| {
            let config_clone = config.clone();
            thread::spawn(move || {
                create_jwt(
                    &format!("user{}", i),
                    &format!("testuser{}", i),
                    &format!("test{}@example.com", i),
                    vec![],
                    vec![],
                    &config_clone,
                )
            })
        })
        .collect();

    let results: Vec<_> = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .collect();

    for result in results {
        assert!(result.is_ok(), "Concurrent token creation should succeed");
        let token_str = result.unwrap();
        let validation = validate_jwt(&token_str, &config);
        assert!(
            validation.is_ok(),
            "Concurrently created tokens should be valid"
        );
    }
}

#[test]
fn test_load_private_pem_from_config_priority() {
    let config = jwt_helpers::create_test_config();
    let private_key = config.jwt_private_key.clone();

    assert!(!private_key.is_empty(), "Config should have private key");
    assert!(
        private_key.contains("BEGIN PRIVATE KEY"),
        "Config key should be PEM format"
    );
}

#[test]
fn test_load_public_pem_from_config_priority() {
    let config = jwt_helpers::create_test_config();
    let public_key = config.jwt_public_key.clone();

    assert!(!public_key.is_empty(), "Config should have public key");
    assert!(
        public_key.contains("BEGIN PUBLIC KEY"),
        "Config key should be PEM format"
    );
}

#[test]
fn test_config_keys_have_valid_pem_format() {
    let config = jwt_helpers::create_test_config();

    let private_key = config.jwt_private_key.clone();
    let public_key = config.jwt_public_key.clone();

    assert!(
        private_key.contains("BEGIN PRIVATE KEY"),
        "Private key should have PEM header"
    );
    assert!(
        private_key.contains("END PRIVATE KEY"),
        "Private key should have PEM footer"
    );
    assert!(
        public_key.contains("BEGIN PUBLIC KEY"),
        "Public key should have PEM header"
    );
    assert!(
        public_key.contains("END PUBLIC KEY"),
        "Public key should have PEM footer"
    );
}

#[test]
fn test_load_pem_from_files_when_config_empty() {
    let _lock = KEY_FILE_LOCK.lock().expect("lock key files");
    let crate_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let _cwd = CwdGuard::set(&crate_dir);

    let mut config = jwt_helpers::create_test_config();
    let private_pem = config.jwt_private_key.clone();
    let public_pem = config.jwt_public_key.clone();
    config.jwt_private_key.clear();
    config.jwt_public_key.clear();

    let _keys = KeyFilesGuard::write(&crate_dir, &private_pem, &public_pem);

    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .expect("create_jwt should load keys from files");
    let claims = validate_jwt(&token, &config).expect("validate_jwt should load keys from files");
    assert_eq!(claims.sub, "user123");
}

#[test]
fn test_load_pem_missing_files_error() {
    let _lock = KEY_FILE_LOCK.lock().expect("lock key files");
    let temp_dir = TempDirGuard::new("jwt_missing_keys");
    let _cwd = CwdGuard::set(temp_dir.path());

    let mut config = jwt_helpers::create_test_config();
    config.jwt_private_key.clear();
    config.jwt_public_key.clear();

    let result = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    );
    assert!(result.is_err(), "Missing key files should return error");
}

#[test]
fn test_create_jwt_invalid_private_pem() {
    let mut config = jwt_helpers::create_test_config();
    config.jwt_private_key = "not a pem".to_string();

    let result = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    );
    assert!(result.is_err(), "Invalid private key should error");
}

#[test]
fn test_validate_jwt_invalid_public_pem() {
    let config = jwt_helpers::create_test_config();
    let token = create_jwt(
        "user123",
        "testuser",
        "test@example.com",
        vec![],
        vec![],
        &config,
    )
    .unwrap();

    let mut bad_config = jwt_helpers::create_test_config();
    bad_config.jwt_public_key = "not a pem".to_string();

    let result = validate_jwt(&token, &bad_config);
    assert!(result.is_err(), "Invalid public key should error");
}
