//! Utility functions.
//!
//! Small, general-purpose helpers that don't belong to any specific
//! domain module.

/// Generate a new unique identifier (UUID v4).
pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Simple pseudo-random u64 based on the current timestamp (not cryptographic).
#[allow(dead_code)]
pub fn rand_u64() -> u64 {
    use std::time::SystemTime;
    let d = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    d.as_nanos() as u64
}
