//! Comprehensive error handling.
//!
//! Defines the application-wide error type with categorization,
//! recovery strategies, and error tracking capabilities.

pub mod recovery;
pub mod retry;
pub mod telemetry;
pub mod transaction;

#[cfg(test)]
mod integration_tests;

use recovery::RecoveryStrategy;
use std::fmt;

/// Error category for user-facing errors (validation, invalid input).
#[derive(Debug)]
pub struct UserError {
    pub message: String,
    pub source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

/// Error category for internal system failures.
#[derive(Debug)]
pub struct SystemError {
    pub message: String,
    pub source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

/// Error category for network-related failures.
#[derive(Debug)]
pub struct NetworkError {
    pub message: String,
    pub source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

/// Error category for file system operations.
#[derive(Debug)]
pub struct FileError {
    pub message: String,
    pub source: Option<Box<dyn std::error::Error + Send + Sync>>,
}

/// Top-level application error with categorization.
#[derive(Debug)]
pub enum AppError {
    /// User-facing errors (validation failures, invalid input).
    User(UserError),
    /// Internal system errors (resource exhaustion, internal failures).
    System(SystemError),
    /// Network errors (connection failures, timeouts).
    Network(NetworkError),
    /// File system errors (not found, permission denied, corrupt data).
    File(FileError),
}

impl AppError {
    /// Returns the default recovery strategy for this error.
    pub fn recovery_strategy(&self) -> RecoveryStrategy {
        match self {
            AppError::User(_) => RecoveryStrategy::Abort,
            AppError::System(_) => RecoveryStrategy::Retry { max_attempts: 3 },
            AppError::Network(_) => RecoveryStrategy::Retry { max_attempts: 5 },
            AppError::File(e) => {
                if e.message.contains("not found") {
                    RecoveryStrategy::Fallback {
                        description: "use default or create new file".to_string(),
                    }
                } else if e.message.contains("permission denied") {
                    RecoveryStrategy::Abort
                } else {
                    RecoveryStrategy::Retry { max_attempts: 2 }
                }
            }
        }
    }

    /// Creates a user error from a message.
    pub fn user(message: impl Into<String>) -> Self {
        let msg = message.into();
        log::warn!("User error: {}", msg);
        AppError::User(UserError {
            message: msg,
            source: None,
        })
    }

    /// Creates a system error from a message.
    pub fn system(message: impl Into<String>) -> Self {
        let msg = message.into();
        log::error!("System error: {}", msg);
        AppError::System(SystemError {
            message: msg,
            source: None,
        })
    }

    /// Creates a network error from a message.
    pub fn network(message: impl Into<String>) -> Self {
        let msg = message.into();
        log::warn!("Network error: {}", msg);
        AppError::Network(NetworkError {
            message: msg,
            source: None,
        })
    }

    /// Creates a file error from a message.
    pub fn file(message: impl Into<String>) -> Self {
        let msg = message.into();
        log::error!("File error: {}", msg);
        AppError::File(FileError {
            message: msg,
            source: None,
        })
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::User(e) => write!(f, "User error: {}", e.message),
            AppError::System(e) => write!(f, "System error: {}", e.message),
            AppError::Network(e) => write!(f, "Network error: {}", e.message),
            AppError::File(e) => write!(f, "File error: {}", e.message),
        }
    }
}

impl std::error::Error for AppError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            AppError::User(e) => e.source.as_ref().map(|s| s.as_ref() as &dyn std::error::Error),
            AppError::System(e) => {
                e.source.as_ref().map(|s| s.as_ref() as &dyn std::error::Error)
            }
            AppError::Network(e) => {
                e.source.as_ref().map(|s| s.as_ref() as &dyn std::error::Error)
            }
            AppError::File(e) => e.source.as_ref().map(|s| s.as_ref() as &dyn std::error::Error),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        let message = e.to_string();
        log::error!("I/O error: {}", message);
        AppError::File(FileError {
            message,
            source: Some(Box::new(e)),
        })
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        let message = e.to_string();
        log::error!("Serialization error: {}", message);
        AppError::System(SystemError {
            message,
            source: Some(Box::new(e)),
        })
    }
}

/// Convenience alias used throughout the crate.
pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_error_has_abort_recovery_strategy() {
        let error = AppError::user("Invalid input");
        assert_eq!(error.recovery_strategy(), RecoveryStrategy::Abort);
    }

    #[test]
    fn system_error_has_retry_recovery_strategy() {
        let error = AppError::system("Resource exhausted");
        assert_eq!(
            error.recovery_strategy(),
            RecoveryStrategy::Retry { max_attempts: 3 }
        );
    }

    #[test]
    fn network_error_has_retry_recovery_strategy() {
        let error = AppError::network("Connection timeout");
        assert_eq!(
            error.recovery_strategy(),
            RecoveryStrategy::Retry { max_attempts: 5 }
        );
    }

    #[test]
    fn file_not_found_error_has_fallback_recovery_strategy() {
        let error = AppError::file("File not found");
        match error.recovery_strategy() {
            RecoveryStrategy::Fallback { .. } => {}
            _ => panic!("Expected Fallback recovery strategy"),
        }
    }

    #[test]
    fn file_permission_denied_error_has_abort_recovery_strategy() {
        let error = AppError::file("permission denied");
        assert_eq!(error.recovery_strategy(), RecoveryStrategy::Abort);
    }

    #[test]
    fn file_error_default_has_retry_recovery_strategy() {
        let error = AppError::file("Corrupt data");
        assert_eq!(
            error.recovery_strategy(),
            RecoveryStrategy::Retry { max_attempts: 2 }
        );
    }

    #[test]
    fn user_error_displays_correctly() {
        let error = AppError::user("Invalid email format");
        assert_eq!(error.to_string(), "User error: Invalid email format");
    }

    #[test]
    fn system_error_displays_correctly() {
        let error = AppError::system("Out of memory");
        assert_eq!(error.to_string(), "System error: Out of memory");
    }

    #[test]
    fn network_error_displays_correctly() {
        let error = AppError::network("Connection refused");
        assert_eq!(error.to_string(), "Network error: Connection refused");
    }

    #[test]
    fn file_error_displays_correctly() {
        let error = AppError::file("File not found");
        assert_eq!(error.to_string(), "File error: File not found");
    }

    #[test]
    fn io_error_converts_to_file_error() {
        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "test.txt not found");
        let app_error = AppError::from(io_error);
        assert!(matches!(app_error, AppError::File(_)));
    }

    #[test]
    fn serde_error_converts_to_system_error() {
        let json = "{ invalid json";
        let serde_error = serde_json::from_str::<serde_json::Value>(json).unwrap_err();
        let app_error = AppError::from(serde_error);
        assert!(matches!(app_error, AppError::System(_)));
    }
}
