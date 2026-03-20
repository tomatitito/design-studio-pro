//! Error telemetry and statistics collection.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Categories of errors for telemetry tracking.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorCategory {
    User,
    System,
    Network,
    File,
}

impl std::fmt::Display for ErrorCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ErrorCategory::User => write!(f, "User"),
            ErrorCategory::System => write!(f, "System"),
            ErrorCategory::Network => write!(f, "Network"),
            ErrorCategory::File => write!(f, "File"),
        }
    }
}

/// Statistics for a specific error category.
#[derive(Debug, Clone, Default)]
pub struct ErrorStats {
    /// Total number of errors in this category.
    pub count: u64,
    /// Frequency as a percentage of total errors (calculated on demand).
    pub frequency_percent: f64,
}

/// Thread-safe error telemetry collector.
#[derive(Clone)]
pub struct ErrorTelemetry {
    stats: Arc<Mutex<HashMap<ErrorCategory, u64>>>,
}

impl ErrorTelemetry {
    /// Creates a new error telemetry collector.
    pub fn new() -> Self {
        ErrorTelemetry {
            stats: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Records an error occurrence for a specific category.
    pub fn record(&self, category: ErrorCategory) {
        let mut stats = self.stats.lock().unwrap();
        *stats.entry(category).or_insert(0) += 1;
    }

    /// Returns the count of errors for a specific category.
    pub fn get_count(&self, category: ErrorCategory) -> u64 {
        let stats = self.stats.lock().unwrap();
        *stats.get(&category).unwrap_or(&0)
    }

    /// Returns the total number of errors across all categories.
    pub fn total_errors(&self) -> u64 {
        let stats = self.stats.lock().unwrap();
        stats.values().sum()
    }

    /// Returns a summary report of all error statistics.
    pub fn summary(&self) -> HashMap<ErrorCategory, ErrorStats> {
        let stats = self.stats.lock().unwrap();
        let total = stats.values().sum::<u64>() as f64;

        stats
            .iter()
            .map(|(&category, &count)| {
                let frequency_percent = if total > 0.0 {
                    (count as f64 / total) * 100.0
                } else {
                    0.0
                };
                (
                    category,
                    ErrorStats {
                        count,
                        frequency_percent,
                    },
                )
            })
            .collect()
    }

    /// Resets all error statistics.
    pub fn reset(&self) {
        let mut stats = self.stats.lock().unwrap();
        stats.clear();
    }
}

impl Default for ErrorTelemetry {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for ErrorTelemetry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let stats = self.stats.lock().unwrap();
        f.debug_struct("ErrorTelemetry")
            .field("categories", &stats.len())
            .field("total_errors", &stats.values().sum::<u64>())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_telemetry_has_zero_errors() {
        let telemetry = ErrorTelemetry::new();
        assert_eq!(telemetry.total_errors(), 0);
    }

    #[test]
    fn record_increments_category_count() {
        let telemetry = ErrorTelemetry::new();
        telemetry.record(ErrorCategory::User);
        assert_eq!(telemetry.get_count(ErrorCategory::User), 1);
    }

    #[test]
    fn record_multiple_errors_in_same_category() {
        let telemetry = ErrorTelemetry::new();
        telemetry.record(ErrorCategory::System);
        telemetry.record(ErrorCategory::System);
        telemetry.record(ErrorCategory::System);
        assert_eq!(telemetry.get_count(ErrorCategory::System), 3);
    }

    #[test]
    fn record_errors_in_different_categories() {
        let telemetry = ErrorTelemetry::new();
        telemetry.record(ErrorCategory::User);
        telemetry.record(ErrorCategory::System);
        telemetry.record(ErrorCategory::Network);
        telemetry.record(ErrorCategory::File);

        assert_eq!(telemetry.get_count(ErrorCategory::User), 1);
        assert_eq!(telemetry.get_count(ErrorCategory::System), 1);
        assert_eq!(telemetry.get_count(ErrorCategory::Network), 1);
        assert_eq!(telemetry.get_count(ErrorCategory::File), 1);
        assert_eq!(telemetry.total_errors(), 4);
    }

    #[test]
    fn get_count_returns_zero_for_unrecorded_category() {
        let telemetry = ErrorTelemetry::new();
        assert_eq!(telemetry.get_count(ErrorCategory::Network), 0);
    }

    #[test]
    fn summary_calculates_frequency_percentages() {
        let telemetry = ErrorTelemetry::new();
        telemetry.record(ErrorCategory::User);
        telemetry.record(ErrorCategory::System);
        telemetry.record(ErrorCategory::System);
        telemetry.record(ErrorCategory::File);

        let summary = telemetry.summary();

        // Total: 4 errors
        // User: 1/4 = 25%
        // System: 2/4 = 50%
        // File: 1/4 = 25%
        assert_eq!(summary.get(&ErrorCategory::User).unwrap().count, 1);
        assert!((summary.get(&ErrorCategory::User).unwrap().frequency_percent - 25.0).abs() < 0.01);

        assert_eq!(summary.get(&ErrorCategory::System).unwrap().count, 2);
        assert!(
            (summary
                .get(&ErrorCategory::System)
                .unwrap()
                .frequency_percent
                - 50.0)
                .abs()
                < 0.01
        );

        assert_eq!(summary.get(&ErrorCategory::File).unwrap().count, 1);
        assert!((summary.get(&ErrorCategory::File).unwrap().frequency_percent - 25.0).abs() < 0.01);
    }

    #[test]
    fn summary_handles_empty_telemetry() {
        let telemetry = ErrorTelemetry::new();
        let summary = telemetry.summary();
        assert!(summary.is_empty());
    }

    #[test]
    fn reset_clears_all_statistics() {
        let telemetry = ErrorTelemetry::new();
        telemetry.record(ErrorCategory::User);
        telemetry.record(ErrorCategory::System);
        telemetry.reset();

        assert_eq!(telemetry.total_errors(), 0);
        assert_eq!(telemetry.get_count(ErrorCategory::User), 0);
        assert_eq!(telemetry.get_count(ErrorCategory::System), 0);
    }

    #[test]
    fn telemetry_is_thread_safe() {
        use std::thread;

        let telemetry = ErrorTelemetry::new();
        let mut handles = vec![];

        for _ in 0..10 {
            let telemetry_clone = telemetry.clone();
            let handle = thread::spawn(move || {
                for _ in 0..100 {
                    telemetry_clone.record(ErrorCategory::System);
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        assert_eq!(telemetry.get_count(ErrorCategory::System), 1000);
    }

    #[test]
    fn error_category_displays_correctly() {
        assert_eq!(ErrorCategory::User.to_string(), "User");
        assert_eq!(ErrorCategory::System.to_string(), "System");
        assert_eq!(ErrorCategory::Network.to_string(), "Network");
        assert_eq!(ErrorCategory::File.to_string(), "File");
    }

    #[test]
    fn telemetry_debug_shows_useful_info() {
        let telemetry = ErrorTelemetry::new();
        telemetry.record(ErrorCategory::User);
        let debug_str = format!("{:?}", telemetry);
        assert!(debug_str.contains("ErrorTelemetry"));
    }
}
