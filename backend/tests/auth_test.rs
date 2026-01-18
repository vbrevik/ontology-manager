use sqlx::PgPool;
use template_repo_backend::features::auth::models::{LoginUser, RegisterUser};
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_register_and_login_flow(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Register User
    let username = "testuser";
    let email = "testuser@example.com";
    let password = "StrongPassword123!";

    let register_input = RegisterUser {
        username: username.to_string(),
        email: email.to_string(),
        password: password.to_string(),
    };

    let register_res = services.auth_service.register(register_input).await;
    assert!(
        register_res.is_ok(),
        "Registration failed: {:?}",
        register_res.err()
    );

    let auth_data = register_res.unwrap();
    assert!(!auth_data.access_token.unwrap().is_empty());
    assert!(!auth_data.refresh_token.unwrap().is_empty());

    // 2. Login User
    let login_input = LoginUser {
        identifier: email.to_string(), // Login with email
        password: password.to_string(),
        remember_me: Some(true),
    };

    let login_res = services.auth_service.login(login_input, None, None).await;
    assert!(login_res.is_ok(), "Login failed: {:?}", login_res.err());

    let login_data = login_res.unwrap();
    assert!(!login_data.access_token.unwrap().is_empty());

    // 3. Verify User exists in DB
    use sqlx::Row;
    let row = sqlx::query("SELECT username FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool) // Using the pool directly
        .await
        .expect("Failed to fetch user");

    let saved_username: String = row.try_get("username").expect("Failed to get username");

    assert_eq!(saved_username, username);
}

#[sqlx::test]
async fn test_duplicate_registration_fails(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    let input = RegisterUser {
        username: "uniq_user".to_string(),
        email: "uniq@example.com".to_string(),
        password: "password".to_string(),
    };

    // First registration
    let _ = services
        .auth_service
        .register(input.clone())
        .await
        .expect("First registration failed");

    // Second registration (should fail)
    let res = services.auth_service.register(input).await;
    assert!(res.is_err());
}

#[sqlx::test]
async fn test_change_password(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Setup: Register
    let email = "pwd_user@example.com";
    let old_password = "OldPassword123!";
    let _ = services
        .auth_service
        .register(RegisterUser {
            username: "pwd_user".to_string(),
            email: email.to_string(),
            password: old_password.to_string(),
        })
        .await
        .unwrap();

    // 1. Change Password - Success
    let new_password = "NewPassword123!";
    let res = services
        .auth_service
        .change_password(email, old_password, new_password)
        .await;
    assert!(res.is_ok(), "Password change failed: {:?}", res.err());

    // 2. Login with OLD password (should fail)
    let login_old = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: old_password.to_string(),
                remember_me: None,
            },
            None,
            None,
        )
        .await;
    assert!(login_old.is_err(), "Login with old password should fail");

    // 3. Login with NEW password (should success)
    let login_new = services
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
    assert!(login_new.is_ok(), "Login with new password should succeed");

    // 4. Change Password - Invalid Current Password
    let res_fail = services
        .auth_service
        .change_password(email, "WrongCurrent", "NewerPwd")
        .await;
    assert!(
        res_fail.is_err(),
        "Changing password with wrong current password should fail"
    );
}

#[sqlx::test]
async fn test_notification_flow(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Setup: Register
    let email = "notif_user@example.com";
    let _ = services
        .auth_service
        .register(RegisterUser {
            username: "notif_user".to_string(),
            email: email.to_string(),
            password: "password".to_string(),
        })
        .await
        .unwrap();

    // Get User ID
    use sqlx::Row;
    let user_row = sqlx::query("SELECT id FROM unified_users WHERE email = $1")
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap();
    let user_id: Uuid = user_row.get("id");
    let user_id = user_id.to_string();

    // 1. Create Notification
    services
        .auth_service
        .create_notification(&user_id, "Welcome")
        .await
        .unwrap();
    services
        .auth_service
        .create_notification(&user_id, "Alert")
        .await
        .unwrap();

    // 2. List Notifications
    let notifs = services
        .auth_service
        .get_notifications(&user_id)
        .await
        .unwrap();
    assert_eq!(notifs.len(), 2);
    assert_eq!(notifs[0].1, "Alert"); // Descending order
    assert_eq!(notifs[0].2, 0); // Not read

    // 3. Mark Read
    let alert_id = notifs[0].0;
    services
        .auth_service
        .mark_notification_read(alert_id, &user_id)
        .await
        .unwrap();

    let notifs_updated = services
        .auth_service
        .get_notifications(&user_id)
        .await
        .unwrap();
    assert_eq!(notifs_updated[0].2, 1); // Read

    // 4. Mark All Read
    services
        .auth_service
        .mark_all_notifications_read(&user_id)
        .await
        .unwrap();
    let notifs_all = services
        .auth_service
        .get_notifications(&user_id)
        .await
        .unwrap();
    for n in notifs_all {
        assert_eq!(n.2, 1);
    }
}

#[sqlx::test]
async fn test_session_revocation(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // Setup: Register & Login (User 1)
    let email = "session_user@example.com";
    let _ = services
        .auth_service
        .register(RegisterUser {
            username: "session_user".to_string(),
            email: email.to_string(),
            password: "password".to_string(),
        })
        .await
        .unwrap();

    let login_res = services
        .auth_service
        .login(
            LoginUser {
                identifier: email.to_string(),
                password: "password".to_string(),
                remember_me: None,
            },
            None,
            None,
        )
        .await
        .unwrap();

    // Verify Refresh Token works
    let refresh_res = services
        .auth_service
        .refresh_token(login_res.refresh_token.clone().unwrap())
        .await;
    assert!(refresh_res.is_ok());

    // 1. Revoke Session (Logout)
    services
        .auth_service
        .logout(login_res.refresh_token.clone().unwrap())
        .await
        .unwrap();

    // Verify Refresh Token fails
    let refresh_fail = services
        .auth_service
        .refresh_token(login_res.refresh_token.unwrap())
        .await;
    assert!(refresh_fail.is_err());
}
