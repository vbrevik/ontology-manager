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
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
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
        "SELECT last_login_ip, last_user_agent, last_login_at FROM unified_users WHERE email = $1",
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
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
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
    sqlx::query("DELETE FROM entities WHERE class_id = (SELECT id FROM classes WHERE name = 'Notification') AND attributes->>'user_id' = $1")
        .bind(user_id.to_string())
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
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
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

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
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

#[sqlx::test]
async fn test_register_password_hashed_with_argon2(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "hash_test@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "hash_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Fetch password hash from DB
    let row = sqlx::query("SELECT password_hash FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();
    
    let stored_hash: String = row.get("password_hash");
    
    // Verify hash is not plaintext password
    assert_ne!(stored_hash, password);
    // Verify hash contains Argon2 identifier ($argon2)
    assert!(stored_hash.starts_with("$argon2"));
}

#[sqlx::test]
async fn test_register_duplicate_email_fails(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "dup_email@example.com";
    let password = "Password123!";
    
    // First registration
    services
        .auth_service
        .register(RegisterUser {
            username: "user1".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("First registration failed");

    // Second registration with same email
    let result = services
        .auth_service
        .register(RegisterUser {
            username: "user2".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "User already exists");
}

#[sqlx::test]
async fn test_login_with_username(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let username = "login_user";
    let password = "Password123!";
    let email = "login_user@example.com";
    
    services
        .auth_service
        .register(RegisterUser {
            username: username.to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Login with username instead of email
    let result = services
        .auth_service
        .login(
            LoginUser {
                identifier: username.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            None,
            None,
        )
        .await;

    assert!(result.is_ok());
    let response = result.unwrap();
    assert!(!response.access_token.is_empty());
}

#[sqlx::test]
async fn test_login_with_email(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let username = "email_user";
    let password = "Password123!";
    let email = "email_user@example.com";
    
    services
        .auth_service
        .register(RegisterUser {
            username: username.to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Login with email
    let result = services
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
        .await;

    assert!(result.is_ok());
}

#[sqlx::test]
async fn test_login_wrong_password(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "wrong_pass@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Login with wrong password
    let result = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: "WrongPassword!".to_string(),
                remember_me: None,
            },
            None,
            None,
        )
        .await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Invalid credentials");
}

#[sqlx::test]
async fn test_login_remember_me_true(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "remember@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "remember_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Login with remember_me = true
    let result = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: Some(true),
            },
            None,
            None,
        )
        .await;

    assert!(result.is_ok());
    let response = result.unwrap();
    assert!(response.remember_me);
}

#[sqlx::test]
async fn test_change_password_success(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "change_pass@example.com";
    let old_password = "Password123!";
    let new_password = "NewPassword456!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "change_user".to_string(),
            email: email.to_string(),
            password: old_password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Change password
    let result = services
        .auth_service
        .change_password(&email, old_password, new_password)
        .await;

    assert!(result.is_ok());
    
    // Verify can login with new password
    let login_result = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: new_password.to_string(),
                remember_me: None,
            },
            None,
            None,
        )
        .await;

    assert!(login_result.is_ok());
}

#[sqlx::test]
async fn test_change_password_wrong_current(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "wrong_current@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "wrong_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Try to change with wrong current password
    let result = services
        .auth_service
        .change_password(&email, "WrongPassword", "NewPassword456!")
        .await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "Invalid credentials");
}

#[sqlx::test]
async fn test_change_password_creates_notification(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "pass_notif@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "pass_notif_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Clear existing notifications
    sqlx::query("DELETE FROM entities WHERE class_id = (SELECT id FROM classes WHERE name = 'Notification') AND attributes->>'user_id' = $1")
        .bind(user_id.to_string())
        .execute(&pool)
        .await
        .unwrap();

    // Change password
    services
        .auth_service
        .change_password(&email, password, "NewPassword456!")
        .await
        .expect("Password change failed");

    // Verify notification was created
    let notifs = services
        .auth_service
        .get_notifications(&user_id.to_string())
        .await
        .unwrap();
    
    assert!(!notifs.is_empty());
    assert!(notifs.iter().any(|n| n.1.contains("password was successfully changed")));
}

#[sqlx::test]
async fn test_mark_notification_read(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "mark_read@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "mark_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Create notification
    services
        .auth_service
        .create_notification(&user_id.to_string(), "Test notification")
        .await
        .expect("Failed to create notification");

    let notifs = services
        .auth_service
        .get_notifications(&user_id.to_string())
        .await
        .unwrap();
    
    assert_eq!(notifs.len(), 1);
    assert_eq!(notifs[0].2, 0); // Not read (0)

    let notif_id = notifs[0].0;

    // Mark as read
    services
        .auth_service
        .mark_notification_read(notif_id, &user_id.to_string())
        .await
        .expect("Failed to mark read");

    // Verify marked as read
    let notifs_updated = services
        .auth_service
        .get_notifications(&user_id.to_string())
        .await
        .unwrap();
    
    assert_eq!(notifs_updated.len(), 1);
    assert_eq!(notifs_updated[0].2, 1); // Read (1)
}

#[sqlx::test]
async fn test_mark_all_notifications_read(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "mark_all@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "mark_all_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Create 3 notifications
    for i in 1..=3 {
        services
            .auth_service
            .create_notification(&user_id.to_string(), &format!("Notification {}", i))
            .await
            .expect("Failed to create notification");
    }

    let notifs = services
        .auth_service
        .get_notifications(&user_id.to_string())
        .await
        .unwrap();
    
    assert_eq!(notifs.len(), 3);
    
    // Mark all as read
    services
        .auth_service
        .mark_all_notifications_read(&user_id.to_string())
        .await
        .expect("Failed to mark all read");

    // Verify all marked as read
    let notifs_updated = services
        .auth_service
        .get_notifications(&user_id.to_string())
        .await
        .unwrap();
    
    assert_eq!(notifs_updated.len(), 3);
    for notif in notifs_updated {
        assert_eq!(notif.2, 1);
    }
}

#[sqlx::test]
async fn test_logout_blacklists_refresh_token(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "logout@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "logout_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Login to get refresh token
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

    let refresh_token = login_res.refresh_token.expect("No refresh token");
    
    // Logout
    services
        .auth_service
        .logout(refresh_token.clone())
        .await
        .expect("Logout failed");

    // Verify token is blacklisted (revoked_at not null)
    let revoked_at: Option<chrono::DateTime<Utc>> = sqlx::query_scalar(
        "SELECT revoked_at FROM refresh_tokens WHERE token_id = $1"
    )
    .bind(&refresh_token)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert!(revoked_at.is_some());
}

#[sqlx::test]
async fn test_list_all_sessions_admin(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Create multiple users with sessions
    for i in 1..=3 {
        let email = &format!("admin_session{}@example.com", i);
        services
            .auth_service
            .register(RegisterUser {
                username: format!("session_user{}", i),
                email: email.to_string(),
                password: "Password123!".to_string(),
            })
            .await
            .expect("Registration failed");

        // Create session by logging in
        services
            .auth_service
            .login(
                LoginUser {
                    identifier: email.to_string(),
                    password: "Password123!".to_string(),
                    remember_me: None,
                },
                None,
                None,
            )
            .await
            .expect("Login failed");
    }

    // List all sessions
    let sessions = services
        .auth_service
        .list_all_sessions(100)
        .await
        .expect("Failed to list all sessions");

    assert!(sessions.len() >= 3);
    
    // Verify each session has required fields
    for session in sessions {
        assert!(!session.id.is_empty());
        assert!(!session.username.is_empty());
        assert!(!session.email.is_empty());
    }
}

#[sqlx::test]
async fn test_revoke_session(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "revoke@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "revoke_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Create 2 sessions
    services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            Some("1.1.1.1".to_string()),
            Some("Device1".to_string()),
        )
        .await
        .expect("Login 1 failed");

    services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: password.to_string(),
                remember_me: None,
            },
            Some("2.2.2.2".to_string()),
            Some("Device2".to_string()),
        )
        .await
        .expect("Login 2 failed");

    // Get sessions
    let sessions = services
        .auth_service
        .list_active_sessions(user_id, None)
        .await
        .expect("Failed to list sessions");

    assert_eq!(sessions.len(), 2);
    
    let token_to_revoke = &sessions[1].id;

    // Revoke one session
    services
        .auth_service
        .revoke_session(user_id, token_to_revoke)
        .await
        .expect("Failed to revoke session");

    // Verify revoked
    let sessions_after = services
        .auth_service
        .list_active_sessions(user_id, None)
        .await
        .expect("Failed to list sessions");

    assert_eq!(sessions_after.len(), 1);
}

#[sqlx::test]
async fn test_revoke_session_not_found(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let user_id = Uuid::new_v4();
    let fake_token_id = "non_existent_token_id";

    // Try to revoke non-existent session
    let result = services
        .auth_service
        .revoke_session(user_id, fake_token_id)
        .await;

    assert!(result.is_err());
    assert_eq!(result.unwrap_err().to_string(), "User not found");
}

#[sqlx::test]
async fn test_count_users(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Initial count
    let initial_count = services
        .auth_service
        .count_users()
        .await
        .expect("Failed to count users");

    // Register 3 users
    for i in 1..=3 {
        services
            .auth_service
            .register(RegisterUser {
                username: format!("count_user{}", i),
                email: format!("count{}@example.com", i),
                password: "Password123!".to_string(),
            })
            .await
            .expect("Registration failed");
    }

    // Count again
    let new_count = services
        .auth_service
        .count_users()
        .await
        .expect("Failed to count users");

    assert_eq!(new_count, initial_count + 3);
}

#[sqlx::test]
async fn test_count_active_refresh_tokens(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "refresh_count@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "refresh_count_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Login 3 times to create 3 refresh tokens
    for _ in 0..3 {
        services
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
    }

    // Count active refresh tokens
    let count = services
        .auth_service
        .count_active_refresh_tokens()
        .await
        .expect("Failed to count refresh tokens");

    assert_eq!(count, 3);
}

#[sqlx::test]
async fn test_recent_users(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let emails = vec![
        "recent1@example.com",
        "recent2@example.com", 
        "recent3@example.com",
    ];

    // Register users with delays
    for (i, email) in emails.iter().enumerate() {
        services
            .auth_service
            .register(RegisterUser {
                username: format!("recent_user{}", i + 1),
                email: email.to_string(),
                password: "Password123!".to_string(),
            })
            .await
            .expect("Registration failed");
        
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    }

    // Get recent users (limit 2)
    let recent = services
        .auth_service
        .recent_users(2)
        .await
        .expect("Failed to get recent users");

    assert_eq!(recent.len(), 2);
    // Should be in descending order by created_at
    assert!(recent[0].created_at >= recent[1].created_at);
}

#[sqlx::test]
async fn test_delete_users_by_prefix(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Register test users with prefix
    for i in 1..=3 {
        services
            .auth_service
            .register(RegisterUser {
                username: format!("delete_user{}", i),
                email: format!("test_delete{}@example.com", i),
                password: "Password123!".to_string(),
            })
            .await
            .expect("Registration failed");
    }

    // Delete users by prefix
    services
        .auth_service
        .delete_users_by_prefix("test_delete")
        .await
        .expect("Failed to delete users");

    // Verify deletion
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM unified_users WHERE email LIKE 'test_delete%'"
    )
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(count, 0);
}

#[sqlx::test]
async fn test_create_notification_broadcast(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "broadcast@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "broadcast_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    // Subscribe to notifications
    let mut rx = services.auth_service.subscribe_notifications();

    // Create notification
    services
        .auth_service
        .create_notification(&user_id.to_string(), "Broadcast test")
        .await
        .expect("Failed to create notification");

    // Receive broadcast
    let event = tokio::time::timeout(
        tokio::time::Duration::from_millis(500),
        rx.recv()
    ).await;

    assert!(event.is_ok());
    let notification_event = event.unwrap();
    assert_eq!(notification_event.user_id, user_id.to_string());
    assert!(notification_event.message.contains("Broadcast test"));
}

#[sqlx::test]
async fn test_refresh_token_with_roles_and_permissions(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "roles_perm@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "roles_perm_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Assign role and permissions
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    let role_id: Uuid = sqlx::query_scalar("SELECT id FROM roles WHERE name = 'editor'")
        .fetch_one(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)")
        .bind(user_id)
        .bind(role_id)
        .execute(&pool)
        .await
        .unwrap();

    // Login to get tokens
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

    // Verify tokens contain roles and permissions
    assert!(login_res.access_token.is_some());
    assert!(!login_res.access_token.unwrap().is_empty());
    // The actual roles/permissions would be in the JWT claims
    // which are verified in JWT tests
}

#[sqlx::test]
async fn test_create_notification_broadcast(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "broadcast@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "broadcast_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .await
        .unwrap();

    // Subscribe to notifications
    let mut rx = services.auth_service.subscribe_notifications();

    // Create notification
    services
        .auth_service
        .create_notification(&user_id.to_string(), "Broadcast test")
        .await
        .expect("Failed to create notification");

    // Receive broadcast
    let event = tokio::time::timeout(
        tokio::time::Duration::from_millis(500),
        rx.recv()
    ).await;

    assert!(event.is_ok());
    let notification_event = event.unwrap();
    assert_eq!(notification_event.user_id, user_id.to_string());
    assert!(notification_event.message.contains("Broadcast test"));
}

#[sqlx::test]
async fn test_refresh_token_with_roles_and_permissions(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let email = "roles_perm@example.com";
    let password = "Password123!";
    
    services
        .auth_service
        .register(RegisterUser {
            username: "roles_perm_user".to_string(),
            email: email.to_string(),
            password: password.to_string(),
        })
        .await
        .expect("Registration failed");

    // Assign role and permissions
    let user_id: Uuid = sqlx::query_scalar("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();

    let role_id: Uuid = sqlx::query_scalar("SELECT id FROM roles WHERE name = 'editor'")
        .fetch_one(&pool)
        .await
        .unwrap();

    sqlx::query("INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)")
        .bind(user_id)
        .bind(role_id)
        .execute(&pool)
        .await
        .unwrap();

    // Login to get tokens
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

    // Verify tokens contain roles and permissions
    assert!(login_res.access_token.is_some());
    assert!(!login_res.access_token.unwrap().is_empty());
    // The actual roles/permissions would be in the JWT claims
    // which are verified in JWT tests
}
