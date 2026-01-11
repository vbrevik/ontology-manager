use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_users: i64,
    pub active_refresh_tokens: i64,
}

#[derive(Debug, Serialize)]
pub struct ActivityEntry {
    pub id: String,
    pub username: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct AdminDashboardStats {
    pub total_users: i64,
    pub user_growth: f64,
    pub active_roles: i64,
    pub role_growth: f64,
    pub ontology_classes: i64,
    pub class_growth: f64,
    pub policy_denials: i64,
    pub denial_growth: f64,
    pub access_traffic: Vec<AccessTrafficPoint>,
}

#[derive(Debug, Serialize)]
pub struct AccessTrafficPoint {
    pub name: String, // "Mon", "Tue" etc
    pub access: i64,
    pub denies: i64,
}
