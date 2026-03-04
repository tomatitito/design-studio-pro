//! Integration tests demonstrating the complete error handling system.

#[cfg(test)]
mod tests {
    use crate::error::{
        recovery::RecoveryStrategy, retry::*, telemetry::*, transaction::Transaction, AppError,
    };
    use std::sync::{Arc, Mutex};

    #[test]
    fn error_categorization_determines_recovery_strategy() {
        // User errors should abort
        let user_err = AppError::user("Invalid email");
        assert_eq!(user_err.recovery_strategy(), RecoveryStrategy::Abort);

        // System errors should retry
        let sys_err = AppError::system("Out of memory");
        assert_eq!(
            sys_err.recovery_strategy(),
            RecoveryStrategy::Retry { max_attempts: 3 }
        );

        // Network errors should retry more
        let net_err = AppError::network("Timeout");
        assert_eq!(
            net_err.recovery_strategy(),
            RecoveryStrategy::Retry { max_attempts: 5 }
        );

        // File errors have context-specific strategies
        let file_not_found = AppError::file("Config file not found");
        matches!(file_not_found.recovery_strategy(), RecoveryStrategy::Fallback { .. });
    }

    #[tokio::test]
    async fn retry_logic_works_with_error_types() {
        let attempts = Arc::new(Mutex::new(0));
        let attempts_clone = attempts.clone();

        let config = RetryConfig {
            max_retries: 2,
            base_delay: std::time::Duration::from_millis(10),
            backoff_multiplier: 2.0,
        };

        let result = retry_with_backoff(config, move || {
            let mut count = attempts_clone.lock().unwrap();
            let current = *count;
            *count += 1;
            drop(count);

            async move {
                if current < 2 {
                    Err(AppError::network("Connection failed"))
                } else {
                    Ok("Success")
                }
            }
        })
        .await;

        assert!(result.is_ok());
        assert_eq!(*attempts.lock().unwrap(), 3);
    }

    #[test]
    fn transaction_rollback_on_multi_file_operation() {
        let files_created = Arc::new(Mutex::new(Vec::new()));
        let mut tx = Transaction::new();

        // Simulate creating file 1
        {
            let files = files_created.clone();
            files.lock().unwrap().push("file1.txt");
            tx.record(move || {
                files.lock().unwrap().retain(|f| *f != "file1.txt");
                Ok(())
            });
        }

        // Simulate creating file 2
        {
            let files = files_created.clone();
            files.lock().unwrap().push("file2.txt");
            tx.record(move || {
                files.lock().unwrap().retain(|f| *f != "file2.txt");
                Ok(())
            });
        }

        // Verify files are "created"
        assert_eq!(files_created.lock().unwrap().len(), 2);

        // Rollback the transaction
        tx.rollback().unwrap();

        // Verify all files are "deleted"
        assert_eq!(files_created.lock().unwrap().len(), 0);
    }

    #[test]
    fn telemetry_tracks_error_categories() {
        let telemetry = ErrorTelemetry::new();

        // Simulate various errors occurring
        telemetry.record(ErrorCategory::User);
        telemetry.record(ErrorCategory::User);
        telemetry.record(ErrorCategory::System);
        telemetry.record(ErrorCategory::Network);
        telemetry.record(ErrorCategory::Network);
        telemetry.record(ErrorCategory::Network);
        telemetry.record(ErrorCategory::File);

        // Verify counts
        assert_eq!(telemetry.get_count(ErrorCategory::User), 2);
        assert_eq!(telemetry.get_count(ErrorCategory::System), 1);
        assert_eq!(telemetry.get_count(ErrorCategory::Network), 3);
        assert_eq!(telemetry.get_count(ErrorCategory::File), 1);
        assert_eq!(telemetry.total_errors(), 7);

        // Check summary
        let summary = telemetry.summary();
        // Network: 3/7 ≈ 42.86%
        let network_stats = summary.get(&ErrorCategory::Network).unwrap();
        assert_eq!(network_stats.count, 3);
        assert!((network_stats.frequency_percent - 42.857).abs() < 0.01);
    }

    #[tokio::test]
    async fn complete_error_handling_workflow() {
        // This test demonstrates a complete workflow using all error handling features

        let telemetry = Arc::new(ErrorTelemetry::new());
        let attempts = Arc::new(Mutex::new(0));

        // Attempt a network operation with retry and telemetry
        let telemetry_clone = telemetry.clone();
        let attempts_clone = attempts.clone();

        let config = RetryConfig {
            max_retries: 3,
            base_delay: std::time::Duration::from_millis(5),
            backoff_multiplier: 1.5,
        };

        let result = retry_with_backoff(config, move || {
            let mut count_guard = attempts_clone.lock().unwrap();
            let current = *count_guard;
            *count_guard += 1;
            drop(count_guard);

            let telem = telemetry_clone.clone();

            async move {
                if current < 2 {
                    // Simulate transient network failure
                    telem.record(ErrorCategory::Network);
                    Err(AppError::network("Temporary connection issue"))
                } else {
                    // Success on third attempt
                    Ok(42)
                }
            }
        })
        .await;

        // Verify success after retries
        assert_eq!(result.unwrap(), 42);

        // Verify telemetry tracked the failures
        assert_eq!(telemetry.get_count(ErrorCategory::Network), 2);
    }

    #[test]
    fn transaction_commits_prevent_rollback() {
        let state = Arc::new(Mutex::new(vec![]));
        let mut tx = Transaction::new();

        let state_clone = state.clone();
        state.lock().unwrap().push("operation");
        tx.record(move || {
            state_clone.lock().unwrap().clear();
            Ok(())
        });

        // Commit the transaction
        tx.commit();

        // State should remain unchanged (rollback didn't run)
        assert_eq!(state.lock().unwrap().len(), 1);
    }

    #[test]
    fn error_display_messages_are_informative() {
        let user_err = AppError::user("Email must contain @ symbol");
        assert_eq!(
            user_err.to_string(),
            "User error: Email must contain @ symbol"
        );

        let sys_err = AppError::system("Database connection pool exhausted");
        assert_eq!(
            sys_err.to_string(),
            "System error: Database connection pool exhausted"
        );

        let net_err = AppError::network("Request timeout after 30s");
        assert_eq!(
            net_err.to_string(),
            "Network error: Request timeout after 30s"
        );

        let file_err = AppError::file("Cannot write to read-only filesystem");
        assert_eq!(
            file_err.to_string(),
            "File error: Cannot write to read-only filesystem"
        );
    }
}
