use std::env;
use dotenv::dotenv;
use serde::Deserialize;

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
        let mut builder = config::Config::builder()
            .add_source(config::File::with_name("config/default"))
            .add_source(config::Environment::with_prefix("APP"));

        if let Ok(env) = env::var("RUN_MODE") {
            builder = builder.add_source(config::File::with_name(&format!("config/{}", env)).required(false));
        }

        let config = builder.build()?;

        Ok(config.try_deserialize()?)
    }
}

pub fn init() {
    dotenv().ok();
}
