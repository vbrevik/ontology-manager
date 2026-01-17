use chrono::Utc;
use std::fs::OpenOptions;
use std::io::Write;

/// Simple email send stub for local/dev: append a record to `data/emails.log`.
pub fn send_password_change_email(to: &str) -> Result<(), Box<dyn std::error::Error>> {
    let logdir = "data";
    std::fs::create_dir_all(logdir)?;
    let path = format!("{}/emails.log", logdir);
    let mut f = OpenOptions::new().create(true).append(true).open(&path)?;
    let now = Utc::now().to_rfc3339();
    writeln!(f, "[{}] Password change notification sent to: {}", now, to)?;
    Ok(())
}

pub fn send_password_reset_email(to: &str, token: &str) -> Result<(), Box<dyn std::error::Error>> {
    let logdir = "data";
    std::fs::create_dir_all(logdir)?;
    let path = format!("{}/emails.log", logdir);
    let mut f = OpenOptions::new().create(true).append(true).open(&path)?;
    let now = Utc::now().to_rfc3339();
    // Assuming frontend runs on port 5373 by default
    let reset_link = format!("http://localhost:5373/reset-password/{}", token);
    writeln!(f, "[{}] Password reset requested for: {}. Link: {}", now, to, reset_link)?;
    Ok(())
}
