use dotenv::dotenv;
use serde::Deserialize;
use std::{env, fs};

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry: i64,
    pub refresh_token_expiry: i64,
    pub jwt_private_key: String,
    pub jwt_public_key: String,
}

impl Config {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        resolve_database_url_from_env();
        let mut builder = config::Config::builder()
            .add_source(config::File::with_name("config/default"))
            .add_source(config::Environment::with_prefix("APP"));

        if let Ok(env) = env::var("RUN_MODE") {
            builder = builder
                .add_source(config::File::with_name(&format!("config/{}", env)).required(false));
        }

        let config = builder.build()?;

        config.try_deserialize()
    }
}

fn resolve_database_url_from_env() {
    if env::var("APP_DATABASE_URL").is_ok() {
        return;
    }

    if let Ok(database_url) = env::var("DATABASE_URL") {
        env::set_var("APP_DATABASE_URL", database_url);
        return;
    }

    let password = env::var("DB_PASSWORD_FILE")
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .map(|value| value.trim().to_string());

    if let Some(password) = password {
        let host = env::var("DB_HOST").unwrap_or_else(|_| "db".to_string());
        let port = env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
        let user = env::var("DB_USER").unwrap_or_else(|_| "app".to_string());
        let name = env::var("DB_NAME").unwrap_or_else(|_| "app_db".to_string());
        let url = format!(
            "postgres://{}:{}@{}:{}/{}?sslmode=disable",
            user, password, host, port, name
        );
        env::set_var("APP_DATABASE_URL", url);
    }
}

pub fn init() {
    dotenv().ok();
}
