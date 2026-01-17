use chrono::Utc;
use sqlx::PgPool;
use template_repo_backend::features::auth::models::{LoginUser, RegisterUser};
use uuid::Uuid;
use totp_rs::{Algorithm, Secret, TOTP};

mod common;

#[sqlx::test]
async fn test_register_ontology_entity_created(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let username = "ontology_user";
    let email = "ontology@example.com";
    let password = "Password123!";

    let register_input = RegisterUser {
        username: username.to_string(),
        email: email.to_string(),
        password: password.to_string(),
    };

    let _register_res = services
        .auth_service
        .register(register_input)
        .await
        .expect("Registration failed");

    // Fetch user_id from DB
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Verify entity was created in ontology
    let entity = services
        .ontology_service
        .get_entity(user_id)
        .await
        .expect("Ontology entity not found");
    assert_eq!(entity.display_name, username);

    let user_class = services
        .ontology_service
        .get_system_class("User")
        .await
        .expect("User class missing");
    assert_eq!(entity.class_id, user_class.id);
}

#[sqlx::test]
async fn test_login_updates_metadata(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Setup: Register
    let email = "meta@example.com";
    let password = "Password123!";
    services
        .auth_service
        .register(RegisterUser {
            username: "meta_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .unwrap();

    // 2. Login with metadata
    let ip = "1.2.3.4";
    let ua = "TestAgent/1.0";

    services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            Some(ip.to_string()),
            Some(ua.to_string()),
        )
        .await
        .expect("Login failed");

    // 3. Verify in DB
    let user_row = sqlx::query(
        "SELECT last_login_ip, last_user_agent, last_login_at FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_one(&pool)
    .await
    .unwrap();

    use sqlx::Row;
    let saved_ip: String = user_row.get("last_login_ip");
    let saved_ua: String = user_row.get("last_user_agent");
    let saved_at: chrono::DateTime<Utc> = user_row.get("last_login_at");

    assert_eq!(saved_ip, ip);
    assert_eq!(saved_ua, ua);
    assert!(saved_at <= Utc::now());
}

#[sqlx::test]
async fn test_login_new_device_notification(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Setup: Register & Initial Login
    let email = "device@example.com";
    let password = "Password123!";
    let _reg = services
        .auth_service
        .register(RegisterUser {
            username: "device_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .unwrap();

    // Fetch user_id from DB
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();
    let user_id_str = user_id.to_string();

    services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            Some("127.0.0.1".to_string()),
            Some("Chrome".to_string()),
        )
        .await
        .unwrap();

    // Clear initial notifications if any
    sqlx::query("DELETE FROM notifications WHERE user_id = $1")
        .bind(user_id)
        .execute(&pool)
        .await
        .unwrap();

    // 2. Login from NEW device (IP change)
    services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            Some("1.1.1.1".to_string()),
            Some("Chrome".to_string()),
        )
        .await
        .unwrap();

    // 3. Verify notification created
    let notifs = services
        .auth_service
        .get_notifications(&user_id_str)
        .await
        .unwrap();
    assert!(!notifs.is_empty());
    assert!(notifs[0].1.contains("New sign-in detected"));
}

#[sqlx::test]
async fn test_refresh_token_rotation(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Login
    let email = "rotate@example.com";
    let password = "Password123!";
    services
        .auth_service
        .register(RegisterUser {
            username: "rotate_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .unwrap();

    let login_res = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            None,
            None,
        )
        .await
        .unwrap();

    let old_token = login_res.refresh_token.expect("Refresh token missing");

    // 2. Refresh
    let refresh_res = services
        .auth_service
        .refresh_token(old_token.clone())
        .await
        .expect("Refresh failed");
    let new_token = refresh_res.refresh_token.expect("New refresh token missing");

    assert_ne!(old_token, new_token, "Token should be rotated");

    // 3. Verify old token is blacklisted/invalid
    let reuse_res = services.auth_service.refresh_token(old_token).await;
    assert!(
        reuse_res.is_err(),
        "Old token should be invalid after rotation"
    );
}

#[sqlx::test]
async fn test_list_active_sessions(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "sessions@example.com";
    services
        .auth_service
        .register(RegisterUser {
            username: "sess_user".to_string(),
            email: email.to_string(),
            password: "Password123!".to_string(),
        })
        .await
        .unwrap();

    // 1. Two logins = Two sessions
    services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: "Password123!".to_string(),
                remember_me: None,
            },
            Some("1.1.1.1".to_string()),
            Some("Device1".to_string()),
        )
        .await
        .unwrap();

    let _login2 = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: "Password123!".to_string(),
                remember_me: None,
            },
            Some("2.2.2.2".to_string()),
            Some("Device2".to_string()),
        )
        .await
        .unwrap();

    // 2. List sessions
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    let sessions = services
        .auth_service
        .list_active_sessions(user_id, None)
        .await
        .expect("Failed to list sessions");

    assert!(sessions.len() >= 2);

    let ip1_exists = sessions
        .iter()
        .any(|s| s.ip_address.as_deref() == Some("1.1.1.1"));
    let ip2_exists = sessions
        .iter()
        .any(|s| s.ip_address.as_deref() == Some("2.2.2.2"));

    assert!(ip1_exists);
    assert!(ip2_exists);
}

#[sqlx::test]
async fn test_login_mfa_flow(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Register
    let email = "mfa_login@example.com";
    let password = "Password123!";
    let _reg = services
        .auth_service
        .register(RegisterUser {
            username: "mfa_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .unwrap();

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // 2. Setup MFA
    let setup_res = services
        .mfa_service
        .setup_mfa(user_id, email)
        .await
        .expect("MFA setup failed");

    // Verify setup
    let secret = Secret::Encoded(setup_res.secret).to_bytes().unwrap();
    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret, None, "".to_string()).unwrap();
    let code = totp.generate_current().unwrap();
    services.mfa_service.verify_setup(user_id, &code).await.unwrap();

    // 3. Login - Should now require MFA
    let login_res = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            None,
            None,
        )
        .await
        .expect("Login failed");

    assert!(login_res.mfa_required);
    assert!(login_res.access_token.is_none());
    assert!(login_res.mfa_token.is_some());
}
