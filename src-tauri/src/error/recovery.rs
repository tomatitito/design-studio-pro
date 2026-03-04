//! Error recovery strategies.

use std::fmt;

/// Defines how to recover from an error.
#[derive(Debug, Clone, PartialEq)]
pub enum RecoveryStrategy {
    /// Retry the operation with a maximum number of attempts.
    Retry { max_attempts: u32 },
    /// Use a fallback value or alternative action.
    Fallback { description: String },
    /// The error is unrecoverable; abort the operation.
    Abort,
    /// Log the error and continue execution.
    Ignore,
}

impl fmt::Display for RecoveryStrategy {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RecoveryStrategy::Retry { max_attempts } => {
                write!(f, "Retry (max {} attempts)", max_attempts)
            }
            RecoveryStrategy::Fallback { description } => {
                write!(f, "Fallback: {}", description)
            }
            RecoveryStrategy::Abort => write!(f, "Abort"),
            RecoveryStrategy::Ignore => write!(f, "Ignore"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovery_strategy_retry_displays_correctly() {
        let strategy = RecoveryStrategy::Retry { max_attempts: 3 };
        assert_eq!(strategy.to_string(), "Retry (max 3 attempts)");
    }

    #[test]
    fn recovery_strategy_fallback_displays_correctly() {
        let strategy = RecoveryStrategy::Fallback {
            description: "use default value".to_string(),
        };
        assert_eq!(strategy.to_string(), "Fallback: use default value");
    }

    #[test]
    fn recovery_strategy_abort_displays_correctly() {
        let strategy = RecoveryStrategy::Abort;
        assert_eq!(strategy.to_string(), "Abort");
    }

    #[test]
    fn recovery_strategy_ignore_displays_correctly() {
        let strategy = RecoveryStrategy::Ignore;
        assert_eq!(strategy.to_string(), "Ignore");
    }

    #[test]
    fn recovery_strategies_are_cloneable() {
        let strategy = RecoveryStrategy::Retry { max_attempts: 5 };
        let cloned = strategy.clone();
        assert_eq!(strategy, cloned);
    }
}
