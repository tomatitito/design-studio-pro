//! Retry logic with exponential backoff.

use std::future::Future;
use std::time::Duration;

/// Configuration for retry behavior.
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts.
    pub max_retries: u32,
    /// Base delay before the first retry.
    pub base_delay: Duration,
    /// Multiplier for exponential backoff (e.g., 2.0 doubles delay each time).
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        RetryConfig {
            max_retries: 3,
            base_delay: Duration::from_millis(100),
            backoff_multiplier: 2.0,
        }
    }
}

/// Retries an async operation with exponential backoff.
///
/// Returns the successful result or the last error encountered.
pub async fn retry_with_backoff<F, Fut, T, E>(config: RetryConfig, mut f: F) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
{
    let mut last_error = None;
    let mut delay = config.base_delay;

    for attempt in 0..=config.max_retries {
        match f().await {
            Ok(result) => {
                if attempt > 0 {
                    log::info!("Retry succeeded after {} attempt(s)", attempt);
                }
                return Ok(result);
            }
            Err(e) => {
                last_error = Some(e);
                if attempt < config.max_retries {
                    log::debug!(
                        "Retry attempt {} failed, retrying after {:?}...",
                        attempt + 1,
                        delay
                    );
                    tokio::time::sleep(delay).await;
                    delay =
                        Duration::from_secs_f64(delay.as_secs_f64() * config.backoff_multiplier);
                } else {
                    log::warn!("All {} retry attempts exhausted", config.max_retries + 1);
                }
            }
        }
    }

    Err(last_error.expect("retry loop should have set last_error"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[tokio::test]
    async fn retry_succeeds_on_first_attempt() {
        let config = RetryConfig::default();
        let result = retry_with_backoff(config, || async { Ok::<_, String>(42) }).await;
        assert_eq!(result, Ok(42));
    }

    #[tokio::test]
    async fn retry_succeeds_after_failures() {
        let config = RetryConfig {
            max_retries: 3,
            base_delay: Duration::from_millis(10),
            backoff_multiplier: 1.5,
        };
        let attempts = Arc::new(AtomicU32::new(0));
        let attempts_clone = attempts.clone();

        let result = retry_with_backoff(config, move || {
            let count = attempts_clone.fetch_add(1, Ordering::SeqCst);
            async move {
                if count < 2 {
                    Err("not yet")
                } else {
                    Ok(100)
                }
            }
        })
        .await;

        assert_eq!(result, Ok(100));
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn retry_fails_after_max_retries() {
        let config = RetryConfig {
            max_retries: 2,
            base_delay: Duration::from_millis(10),
            backoff_multiplier: 2.0,
        };
        let attempts = Arc::new(AtomicU32::new(0));
        let attempts_clone = attempts.clone();

        let result = retry_with_backoff(config, move || {
            attempts_clone.fetch_add(1, Ordering::SeqCst);
            async move { Err::<i32, _>("always fails") }
        })
        .await;

        assert_eq!(result, Err("always fails"));
        // max_retries = 2 means 3 total attempts (initial + 2 retries)
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn retry_uses_exponential_backoff() {
        let config = RetryConfig {
            max_retries: 2,
            base_delay: Duration::from_millis(50),
            backoff_multiplier: 2.0,
        };

        let start = std::time::Instant::now();
        let _ = retry_with_backoff(config, || async { Err::<i32, _>("fail") }).await;
        let elapsed = start.elapsed();

        // First retry: 50ms, second retry: 100ms
        // Total should be at least 150ms
        assert!(elapsed >= Duration::from_millis(150));
    }

    #[test]
    fn retry_config_default_values_are_reasonable() {
        let config = RetryConfig::default();
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.base_delay, Duration::from_millis(100));
        assert_eq!(config.backoff_multiplier, 2.0);
    }
}
