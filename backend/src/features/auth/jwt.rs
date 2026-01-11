use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey, Algorithm};
use serde::{Serialize, Deserialize};
use chrono::{Utc, Duration};
use crate::config::Config;
use std::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserRoleClaim {
    pub role_name: String,
    pub resource_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub email: String,
    pub roles: Vec<UserRoleClaim>,
    pub permissions: Vec<String>,
    pub jti: Option<String>,
    pub exp: i64,
    pub iat: i64,
}

fn load_private_pem(config: &Config) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    if !config.jwt_private_key.trim().is_empty() {
        return Ok(config.jwt_private_key.clone());
    }
    let s = fs::read_to_string("keys/private_key.pem")?;
    Ok(s)
}

fn load_public_pem(config: &Config) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    if !config.jwt_public_key.trim().is_empty() {
        return Ok(config.jwt_public_key.clone());
    }
    let s = fs::read_to_string("keys/public_key.pem")?;
    Ok(s)
}

use rand::Rng;

pub fn create_jwt(user_id: &str, username: &str, email: &str, roles: Vec<UserRoleClaim>, permissions: Vec<String>, config: &Config) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let now = Utc::now();
    let iat = now.timestamp();
    let exp = (now + Duration::seconds(config.jwt_expiry)).timestamp();
 
    let claims = Claims {
        sub: user_id.to_string(),
        username: username.to_string(),
        email: email.to_string(),
        roles,
        permissions,
        jti: None,
        exp,
        iat,
    };
 
    let private_pem = load_private_pem(config)?;
    let encoding_key = if let Ok(k) = EncodingKey::from_rsa_pem(private_pem.as_ref()) {
        k
    } else {
        let pem_block = pem::parse(private_pem.as_str()).map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { Box::new(e) })?;
        EncodingKey::from_rsa_der(&pem_block.contents())
    };
 
    encode(&Header::new(Algorithm::RS256), &claims, &encoding_key)
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
}
 
pub fn create_refresh_token(user_id: &str, username: &str, email: &str, roles: Vec<UserRoleClaim>, permissions: Vec<String>, config: &Config) -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
    let now = Utc::now();
    let iat = now.timestamp();
    let exp = (now + Duration::seconds(config.refresh_token_expiry)).timestamp();
 
    let jti = format!("{:x}", rand::thread_rng().gen::<u128>());
    let claims = Claims {
        sub: user_id.to_string(),
        username: username.to_string(),
        email: email.to_string(),
        roles,
        permissions,
        jti: Some(jti.clone()),
        exp,
        iat,
    };

    let private_pem = load_private_pem(config)?;
    let encoding_key = if let Ok(k) = EncodingKey::from_rsa_pem(private_pem.as_ref()) {
        k
    } else {
        let pem_block = pem::parse(private_pem.as_str()).map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { Box::new(e) })?;
        EncodingKey::from_rsa_der(&pem_block.contents())
    };

    let token = encode(&Header::new(Algorithm::RS256), &claims, &encoding_key)
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
    Ok((token, jti))
}

pub fn validate_jwt(token: &str, config: &Config) -> Result<Claims, Box<dyn std::error::Error + Send + Sync>> {
    let public_pem = load_public_pem(config)?;
    let decoding_key = if let Ok(k) = DecodingKey::from_rsa_pem(public_pem.as_ref()) {
        k
    } else {
        let pem_block = pem::parse(public_pem.as_str()).map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { Box::new(e) })?;
        DecodingKey::from_rsa_der(&pem_block.contents())
    };

    decode::<Claims>(token, &decoding_key, &Validation::new(Algorithm::RS256))
        .map(|data| data.claims)
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)
}
