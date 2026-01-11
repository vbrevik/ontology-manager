pub mod features;
pub mod config;
pub mod middleware;

pub use features::auth::service::AuthService as AppState;
