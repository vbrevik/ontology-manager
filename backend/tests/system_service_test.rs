use sqlx::PgPool;
use uuid::Uuid;

mod common;

#[sqlx::test]
async fn test_system_metrics_and_reporting(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Get Initial Metrics
    let metrics = services.system_service.get_metrics();
    assert!(!metrics.hostname.is_empty());

    // 2. Generate Report
    let report_type = "security_summary";
    let report = services
        .system_service
        .generate_report(report_type.to_string())
        .await
        .expect("Failed to generate report");

    assert_eq!(report.report_type, report_type);
    let status = report.status.to_uppercase();
    assert!(status == "COMPLETED" || status == "PENDING");

    // 3. List Reports
    let all_reports = services
        .system_service
        .get_reports()
        .await
        .expect("Failed to list reports");
    assert!(!all_reports.is_empty());
    assert_eq!(all_reports[0].id, report.id);
}

#[sqlx::test]
async fn test_audit_log_retrieval(pool: PgPool) {
    let services = common::setup_services(pool.clone()).await;

    // 1. Create a real user first (to satisfy FK)
    let user = services
        .user_service
        .create("audit_test", "audit@e.com", "p", None)
        .await
        .unwrap();

    // 2. Insert manual audit log linked to real user
    sqlx::query(
        "INSERT INTO audit_logs (id, user_id, action, target_type, created_at) VALUES ($1, $2, $3, $4, NOW())"
    )
    .bind(Uuid::new_v4())
    .bind(user.id)
    .bind("test.action")
    .bind("test_target")
    .execute(&pool)
    .await
    .expect("Failed to insert manual audit log");

    // 3. Get Logs
    let logs = services
        .system_service
        .get_logs()
        .await
        .expect("Failed to get logs");

    // Check if test log was retrieved
    let found = logs.iter().any(|l| l.user_id == user.id);
    assert!(found, "Audit log for the real user should be retrieved");
}
