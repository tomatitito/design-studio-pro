//! Transaction rollback mechanism for multi-step operations.

use std::fmt;

/// A rollback action that can be executed to undo an operation.
type RollbackAction = Box<dyn FnOnce() -> Result<(), String> + Send>;

/// A transaction that tracks operations and can be committed or rolled back.
pub struct Transaction {
    operations: Vec<RollbackAction>,
    committed: bool,
}

impl Transaction {
    /// Creates a new transaction.
    pub fn new() -> Self {
        Transaction {
            operations: Vec::new(),
            committed: false,
        }
    }

    /// Records an operation with its rollback action.
    ///
    /// The rollback function will be called in reverse order if the transaction is rolled back.
    pub fn record<F>(&mut self, rollback: F)
    where
        F: FnOnce() -> Result<(), String> + Send + 'static,
    {
        self.operations.push(Box::new(rollback));
    }

    /// Commits the transaction, finalizing all operations.
    ///
    /// Once committed, rollback actions will not be executed even if the transaction is dropped.
    pub fn commit(mut self) {
        log::debug!(
            "Transaction committed with {} operation(s)",
            self.operations.len()
        );
        self.committed = true;
    }

    /// Explicitly rolls back the transaction, executing all rollback actions in reverse order.
    ///
    /// Returns Ok(()) if all rollback actions succeeded, or Err with the first failure message.
    pub fn rollback(mut self) -> Result<(), String> {
        log::info!("Explicitly rolling back transaction");
        self.execute_rollback()
    }

    fn execute_rollback(&mut self) -> Result<(), String> {
        let mut errors = Vec::new();
        let operation_count = self.operations.len();

        if operation_count > 0 {
            log::debug!(
                "Executing {} rollback action(s) in reverse order",
                operation_count
            );
        }

        // Execute rollback actions in reverse order
        while let Some(action) = self.operations.pop() {
            if let Err(e) = action() {
                log::error!("Rollback action failed: {}", e);
                errors.push(e);
            }
        }

        if errors.is_empty() {
            if operation_count > 0 {
                log::info!("Transaction rollback completed successfully");
            }
            Ok(())
        } else {
            let error_msg = errors.join("; ");
            log::error!("Transaction rollback failed: {}", error_msg);
            Err(error_msg)
        }
    }
}

impl Default for Transaction {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for Transaction {
    fn drop(&mut self) {
        if !self.committed && !self.operations.is_empty() {
            // Attempt to rollback if not committed
            let _ = self.execute_rollback();
        }
    }
}

impl fmt::Debug for Transaction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Transaction")
            .field("operations_count", &self.operations.len())
            .field("committed", &self.committed)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[test]
    fn transaction_new_creates_empty_transaction() {
        let tx = Transaction::new();
        assert_eq!(tx.operations.len(), 0);
        assert!(!tx.committed);
    }

    #[test]
    fn transaction_record_adds_rollback_action() {
        let mut tx = Transaction::new();
        tx.record(|| Ok(()));
        assert_eq!(tx.operations.len(), 1);
    }

    #[test]
    fn transaction_commit_prevents_rollback() {
        let executed = Arc::new(Mutex::new(false));
        let executed_clone = executed.clone();

        let mut tx = Transaction::new();
        tx.record(move || {
            *executed_clone.lock().unwrap() = true;
            Ok(())
        });
        tx.commit();
        // Transaction is consumed by commit, no rollback should execute

        assert!(!*executed.lock().unwrap());
    }

    #[test]
    fn transaction_rollback_executes_actions_in_reverse_order() {
        let order = Arc::new(Mutex::new(Vec::new()));

        let mut tx = Transaction::new();

        let order1 = order.clone();
        tx.record(move || {
            order1.lock().unwrap().push(1);
            Ok(())
        });

        let order2 = order.clone();
        tx.record(move || {
            order2.lock().unwrap().push(2);
            Ok(())
        });

        let order3 = order.clone();
        tx.record(move || {
            order3.lock().unwrap().push(3);
            Ok(())
        });

        tx.rollback().unwrap();

        assert_eq!(*order.lock().unwrap(), vec![3, 2, 1]);
    }

    #[test]
    fn transaction_drop_triggers_rollback_if_not_committed() {
        let executed = Arc::new(Mutex::new(false));
        let executed_clone = executed.clone();

        {
            let mut tx = Transaction::new();
            tx.record(move || {
                *executed_clone.lock().unwrap() = true;
                Ok(())
            });
            // Transaction is dropped here without commit
        }

        assert!(*executed.lock().unwrap());
    }

    #[test]
    fn transaction_rollback_returns_error_on_failure() {
        let mut tx = Transaction::new();
        tx.record(|| Ok(()));
        tx.record(|| Err("Operation failed".to_string()));
        tx.record(|| Ok(()));

        let result = tx.rollback();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Operation failed"));
    }

    #[test]
    fn transaction_rollback_collects_multiple_errors() {
        let mut tx = Transaction::new();
        tx.record(|| Err("Error 1".to_string()));
        tx.record(|| Err("Error 2".to_string()));

        let result = tx.rollback();
        assert!(result.is_err());
        let error_msg = result.unwrap_err();
        assert!(error_msg.contains("Error 1") || error_msg.contains("Error 2"));
    }

    #[test]
    fn transaction_debug_shows_state() {
        let mut tx = Transaction::new();
        tx.record(|| Ok(()));
        let debug_str = format!("{:?}", tx);
        assert!(debug_str.contains("operations_count"));
        assert!(debug_str.contains("committed"));
    }
}
