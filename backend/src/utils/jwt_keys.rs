use std::fs;
use std::path::Path;
use rsa::{RsaPrivateKey, RsaPublicKey};
use rsa::pkcs1::{EncodeRsaPrivateKey, LineEnding};
use rsa::pkcs8::EncodePublicKey;
use crate::config::Config;

pub fn generate_and_save_keys() -> Result<(), Box<dyn std::error::Error>> {
    // Generate a 2048-bit RSA key pair
    let private_key = RsaPrivateKey::new(&mut rand::thread_rng(), 2048)?;
    let public_key = RsaPublicKey::from(&private_key);

    // Convert to PEM format (use PKCS1 for the private key to be compatible with jwt parsing)
    let private_pem = private_key.to_pkcs1_pem(LineEnding::LF)?;
    let public_pem = public_key.to_public_key_pem(LineEnding::LF)?;

    // Create keys directory if it doesn't exist
    fs::create_dir_all("keys")?;
    
    // Save private key
    fs::write("keys/private_key.pem", private_pem.to_string())?;
    // Save public key
    fs::write("keys/public_key.pem", public_pem.to_string())?;
    
    println!("RSA keys generated and saved successfully!");
    Ok(())
}

pub fn load_keys(_config: &Config) -> Result<(String, String), Box<dyn std::error::Error>> {
    // Load private key from file
    let private_key = fs::read_to_string("keys/private_key.pem")?;
    // Load public key from file
    let public_key = fs::read_to_string("keys/public_key.pem")?;
    
    Ok((private_key, public_key))
}

pub fn check_keys_exist() -> bool {
    Path::new("keys/private_key.pem").exists() && Path::new("keys/public_key.pem").exists()
}
