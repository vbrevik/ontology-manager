pub mod config;
pub mod features;
pub mod middleware;
pub mod utils;

pub use features::auth::service::AuthService as AppState;
