use std::fs::OpenOptions;
use std::io::Write;
use chrono::Utc;

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


