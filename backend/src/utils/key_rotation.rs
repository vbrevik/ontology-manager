use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use rsa::{RsaPrivateKey, RsaPublicKey};
use rsa::pkcs1::{EncodeRsaPrivateKey, LineEnding};
use rsa::pkcs8::EncodePublicKey;

pub fn rotate_keys() -> Result<(), Box<dyn std::error::Error>> {
    // Generate a new 2048-bit RSA key pair
    let private_key = RsaPrivateKey::new(&mut rand::thread_rng(), 2048)?;
    let public_key = RsaPublicKey::from(&private_key);

    // Convert to PEM format
    let private_pem = private_key.to_pkcs1_pem(LineEnding::LF)?;
    let public_pem = public_key.to_public_key_pem(LineEnding::LF)?;

    // Create keys directory if it doesn't exist
    fs::create_dir_all("keys")?;
    
    // Save new keys with timestamp
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs();
    
    fs::write(format!("keys/private_key_{}.pem", timestamp), private_pem.to_string())?;
    fs::write(format!("keys/public_key_{}.pem", timestamp), public_pem.to_string())?;
    
    // Update current keys
    fs::write("keys/private_key.pem", private_pem.to_string())?;
    fs::write("keys/public_key.pem", public_pem.to_string())?;
    
    println!("Keys rotated successfully! New keys saved with timestamp: {}", timestamp);
    Ok(())
}

pub fn get_key_age() -> Result<u64, Box<dyn std::error::Error>> {
    let metadata = fs::metadata("keys/private_key.pem")?;
    let created_time = metadata.created()?;
    let now = SystemTime::now();
    
    let duration = now.duration_since(created_time)?;
    Ok(duration.as_secs())
}

pub fn is_key_expired(key_age_seconds: u64, max_age_seconds: u64) -> bool {
    key_age_seconds > max_age_seconds
}
