use sqlx::PgPool;
use template_repo_backend::config::Config;
use template_repo_backend::features::{
    abac::AbacService, ai::service::AiService, api_management::service::ApiManagementService,
    auth::service::AuthService, firefighter::service::FirefighterService,
    ontology::OntologyService, rate_limit::service::RateLimitService, rebac::RebacService,
    system::AuditService, system::SystemService, users::service::UserService,
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

    // Rate Limit Service
    let rate_limit_service = RateLimitService::new(pool.clone(), true); // test_mode = true

    // Firefighter Service
    let firefighter_service = FirefighterService::new(
        pool.clone(),
        audit_service.clone(),
        ontology_service.clone(),
    );

    // System Service
    let system_service = SystemService::new(pool.clone(), audit_service.clone());

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
    }
}
