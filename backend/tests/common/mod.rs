use axum::Router;
use sqlx::PgPool;
use std::sync::Arc;
use template_repo_backend::config::Config;
use uuid::Uuid;
use template_repo_backend::features::{
    abac::AbacService,
    ai::service::AiService,
    api_management::service::ApiManagementService,
    auth::models::User,
    auth::service::AuthService,
    firefighter::service::FirefighterService,
    ontology::OntologyService,
    rate_limit::service::RateLimitService,
    rebac::RebacService,
    system::AuditService,
    system::SystemService,
    import_engine::ImportService,
    ontology_sources::OntologySourceService,
    users::service::UserService,
};

#[allow(dead_code)]
pub struct TestServices {
    pub auth_service: AuthService,
    pub user_service: UserService,
    pub ontology_service: OntologyService,
    pub rebac_service: RebacService,
    pub abac_service: AbacService,
    pub audit_service: AuditService,
    pub api_management_service: ApiManagementService,
    pub rate_limit_service: RateLimitService,
    pub firefighter_service: FirefighterService,
    pub ai_service: AiService,
    pub system_service: SystemService,
    pub mfa_service: template_repo_backend::features::auth::mfa::MfaService,
    pub project_service: template_repo_backend::features::projects::ProjectService,
    pub source_service: OntologySourceService,
    pub import_service: ImportService,
}

pub async fn setup_services(pool: PgPool) -> TestServices {
    // Audit Service
    let audit_service = AuditService::new(pool.clone());

    // Ontology Service
    let ontology_service = OntologyService::new(pool.clone(), audit_service.clone());

    // Rebac Service
    let rebac_service = RebacService::new(
        pool.clone(),
        ontology_service.clone(),
        audit_service.clone(),
    );

    // Abac Service
    let abac_service = AbacService::new(
        pool.clone(),
        rebac_service.clone(),
        ontology_service.clone(),
    );

    // User Service
    let user_service = UserService::new(
        pool.clone(),
        audit_service.clone(),
        ontology_service.clone(),
    );

    // Config (Test Mode)
    let config = create_test_config();

    // Generic MFA initialization for tests
    let mfa_service = template_repo_backend::features::auth::mfa::MfaService::new(pool.clone(), "TestIssuer".to_string());

    // Auth Service
    let auth_service = AuthService::new(
        pool.clone(),
        config,
        abac_service.clone(),
        user_service.clone(),
        audit_service.clone(),
        ontology_service.clone(),
        mfa_service.clone(),
    );

    // AI Service - with fallback values for test
    let ai_service = AiService::new(
        pool.clone(),
        "http://localhost:11434".to_string(),
        "llama2".to_string(),
    );

    // API Management Service
    let api_management_service = ApiManagementService::new(pool.clone());

    // Rate Limit Service (test_mode = false to test actual rate limiting)
    let rate_limit_service = RateLimitService::new(pool.clone(), false);

    // Firefighter Service
    let firefighter_service = FirefighterService::new(
        pool.clone(),
        audit_service.clone(),
        ontology_service.clone(),
    );

    // System Service
    let system_service = SystemService::new(pool.clone(), audit_service.clone());

    // Project Service
    let project_service = template_repo_backend::features::projects::ProjectService::new(
        pool.clone(),
        ontology_service.clone(),
        rebac_service.clone(),
    );

    // Ontology Source Service
    let source_service = OntologySourceService::new(
        pool.clone(),
        std::path::PathBuf::from("./test-data"),
    );

    // Import Service
    let import_service = ImportService::new(
        pool.clone(),
        std::path::PathBuf::from("./test-data"),
    );

    TestServices {
        auth_service,
        user_service,
        ontology_service,
        rebac_service,
        abac_service,
        audit_service,
        api_management_service,
        rate_limit_service,
        firefighter_service,
        ai_service,
        system_service,
        mfa_service,
        project_service,
        source_service,
        import_service,
    }
}

pub fn create_test_config() -> Config {
    Config {
        database_url: "postgres://postgres:postgres@localhost:5432/test_db".to_string(),
        jwt_secret: "test_secret_key_12345".to_string(),
        jwt_expiry: 3600,
        refresh_token_expiry: 86400,
        jwt_private_key: r#"-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC3czhGjuolYka4
YC7kML6L0sOluVhvHXsz2AaKcYQIyCe7lVDRUL/IA0WrwAbWzzS896scfbUaE+5k
kEkS2HfSpEq6U8koE5iDcFu2Sv1BsTYidPbYGQKVTHVoMiC5nC73rGfSO4wAVhTv
WA55zbobmkueki1fuwGADtp0hLioppvIFtw1U0lUEiKxoKFOu+ovTjgdYRPcgsZc
7I6sXnlrL3MJd1liKJxbeZn6Bdk7uYTMyzcGF2X6EyaFaxysJhuvXT5GXtICzReC
esPOmfLE6RPoVfDBlmIpqYANemKTXAUn8rlkPbulcW6yINlvCtRwZ9yC5kl6FFvA
FFGLBmUXAgMBAAECggEAMZzbj1l/QXT+o0Z/5/62yaHKf7tMi2BxvWei/TYN+0IG
XNjY7oLkGvenk/du4hFPtftVL3Nf0xmo01GiMZKRdUoxW4rlUA1cpc9xPi+xpl6C
wXbYe0DoTfBLoE5OQ2RV322k9lpcVorxRnmOEKrutiBYax4lX0p38WYS9ogeWJ2f
+zE4V/3inx6WzV5qQrcvGWHKg7G2hRQDtHLw8N7d4QdSNqeGQXLHzQoCQhgpTeX3
mAO5Z9JBpBFxLyPnoWkBGJteappT4hDQuM14LEpav8Mys97cMY2m+znf6nzKhX3C
Cs3ufHTTSaLhRPfVCARw/Fbr4rjkEeRVh0SOgf/ZAQKBgQD6WyUNzHwIPa45XwrY
YFulBLFNOA+nTimISRXJfn2UTg/td6d0PM9wYNtvgnsjTnImuFYDMCKJNfwydFzY
t3ilfIxjPIy8rW4TFuL9FWId/1cxGHqXmGs6kWraBcjlNxt50ash86SVFeJZVeiN
Ivjnzt+uWbNO2VeANNWzjswYtwKBgQC7lfKBm/9BIXcuMNO5i/b6dJwNbHMwuAZ/
agAstt2BG24qBpuJu26lXcp9Qbf0/LcVFO4L+k08lKt5ZwJEHC+1JlRsQXJuIKuk
5S1XTu8MfmvG3MabMP/Q3LIJg1I0W5zRPIMyTKwavTo6ZWPjnIdseaswRl061U6S
7UIdoW32oQKBgQDi9UW+IKZAgkozUGnwhkoOaxagvjXSohUcq8TIiZcmny3pRRPV
WFtlsSi9Cji/ZRou5+Vxtm1YnkwnIT4aaRlCTIqoW/fqA/9J5vGYJY5xS02sAFkC
nPZ4feO0CpJ42WBbKyxM9yc40EIGYs8TQ6UJ4Iz+7eqTjIy6eStSQB3eOQKBgQC5
PFz4d98bpbxWtIie1QPSVowzBUDKfy6La1U40mrxLvEeNuAophmg2nk2L0tEdLkl
7EEVOtpCVFzvyTSHpX3G2E7Nh+NDtKdKcbTQXnXYVI6BFUpZvY0f5o84raDjawPz
6llzthrNXMa/G5gED3H7QDo3tYQisLiihf+f2uUHgQKBgQDrYSPrJDeqsk4s0cYE
rO9tSyWPxXXwXfygKoz7QdrVh3LcRBqvx0UwJRbZ2FWWnfA9LGKvTpbQvyKcWgZM
9gPrLmuGI966lHAQ6JN9C0qhmgJcVo2+vXcaFcmkfBH29sLgM3oCd9aBI1b7d2P5
hi8G6tTdw7IT4M3D69pnq5KFUg==
-----END PRIVATE KEY-----"#
            .to_string(),
        jwt_public_key: r#"-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt3M4Ro7qJWJGuGAu5DC+
i9LDpblYbx17M9gGinGECMgnu5VQ0VC/yANFq8AG1s80vPerHH21GhPuZJBJEth3
0qRKulPJKBOYg3Bbtkr9QbE2InT22BkClUx1aDIguZwu96xn0juMAFYU71gOec26
G5pLnpItX7sBgA7adIS4qKabyBbcNVNJVBIisaChTrvqL044HWET3ILGXOyOrF55
ay9zCXdZYiicW3mZ+gXZO7mEzMs3Bhdl+hMmhWscrCYbr10+Rl7SAs0XgnrDzpny
xOkT6FXwwZZiKamADXpik1wFJ/K5ZD27pXFusiDZbwrUcGfcguZJehRbwBRRiwZl
FwIDAQAB
-----END PUBLIC KEY-----"#
            .to_string(),
        ontology_data_dir: "./test-data".to_string(),
    }
}

/// Create a test user for integration tests
#[allow(dead_code)]
pub async fn create_test_user(
    services: &TestServices,
    username: &str,
    email: &str,
    password: &str,
) -> User {
    services
        .user_service
        .create(username, email, password, None)
        .await
        .expect("Failed to create test user")
}

/// Seed CVE-004 rate limit rules for testing
#[allow(dead_code)]
pub async fn seed_cve004_rate_limit_rules(pool: &PgPool) {
    // Get RateLimitRule class ID
    let class_id: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM classes WHERE name = 'RateLimitRule' LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();

    let class_id = match class_id {
        Some(id) => id,
        None => {
            // RateLimitRule class doesn't exist, skip seeding
            eprintln!("Warning: RateLimitRule class not found, skipping rule seeding");
            return;
        }
    };

    let rules = vec![
        ("auth-login", "Login Rate Limit", 5, 15 * 60),
        ("auth-mfa-challenge", "MFA Challenge Rate Limit", 10, 5 * 60),
        ("auth-forgot-password", "Password Reset Rate Limit", 3, 60 * 60),
        ("auth-register", "Registration Rate Limit", 3, 60 * 60),
    ];

    for (rule_id, name, max_requests, window_seconds) in rules {
        let _ = sqlx::query(
            r#"
            INSERT INTO entities (id, class_id, display_name, attributes, approval_status)
            VALUES ($1, $2, $3, $4, 'APPROVED'::approval_status)
            ON CONFLICT (id) DO UPDATE
            SET attributes = $4
            "#
        )
        .bind(Uuid::parse_str(rule_id).unwrap_or_else(|_| Uuid::new_v4()))
        .bind(class_id)
        .bind(name)
        .bind(serde_json::json!({
            "name": name,
            "endpoint_pattern": format!("/api/auth/{}", rule_id.replace("auth-", "")),
            "max_requests": max_requests,
            "window_seconds": window_seconds,
            "strategy": "IP",
            "enabled": true
        }))
        .execute(pool)
        .await;
    }
}

/// Set up a full test app with all routes and middleware
#[allow(dead_code)]
pub async fn setup_test_app(pool: PgPool) -> Router {
    use template_repo_backend::features;
    use template_repo_backend::middleware;

    let services = setup_services(pool.clone()).await;

    let mfa_state = features::auth::routes::MfaState {
        mfa_service: services.mfa_service.clone(),
        auth_service: services.auth_service.clone(),
    };

    // Build minimal router with auth routes and rate limiting
    Router::new()
        .nest(
            "/api/auth",
            Router::new()
                .merge(features::auth::routes::public_auth_routes())
                .merge(
                    features::auth::routes::protected_auth_routes()
                        .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                        .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf)),
                )
                .layer(axum::middleware::from_fn_with_state(
                    Arc::new(services.rate_limit_service.clone()),
                    features::rate_limit::middleware::rate_limit_middleware,
                )),
        )
        .nest(
            "/api/auth/mfa",
            features::auth::routes::mfa_routes()
                .with_state(mfa_state)
                .layer(axum::middleware::from_fn(middleware::auth::auth_middleware))
                .layer(axum::middleware::from_fn(middleware::csrf::validate_csrf))
                .layer(axum::middleware::from_fn_with_state(
                    Arc::new(services.rate_limit_service.clone()),
                    features::rate_limit::middleware::rate_limit_middleware,
                )),
        )
        .with_state(services.auth_service.clone())
}
