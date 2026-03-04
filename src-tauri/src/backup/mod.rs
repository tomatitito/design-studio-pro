//! Backup management.
//!
//! Handles automatic and manual backups of project files, including
//! snapshot creation, rotation, and restoration.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Configuration for the backup subsystem.
#[derive(Clone)]
pub struct BackupConfig {
    /// Directory where backups are stored.
    pub backup_dir: PathBuf,
    /// Maximum number of backups to retain.
    pub max_backups: usize,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            backup_dir: PathBuf::from("backups"),
            max_backups: 10,
        }
    }
}

/// Project data that will be backed up.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BackupProjectData {
    /// Unique project identifier.
    pub id: String,
    /// Project name.
    pub name: String,
    /// Arbitrary project data.
    pub data: serde_json::Value,
}

/// Metadata associated with a backup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    /// Timestamp when the backup was created.
    pub created_at: DateTime<Utc>,
    /// Project name.
    pub project_name: String,
    /// Backup file size in bytes.
    pub file_size: u64,
    /// SHA-256 checksum of the backup data.
    pub checksum: String,
}

/// Information about a backup.
#[derive(Debug, Clone)]
pub struct BackupInfo {
    /// Project ID.
    pub project_id: String,
    /// Timestamp from filename.
    pub timestamp: DateTime<Utc>,
    /// Path to the backup file.
    pub backup_path: PathBuf,
    /// Path to the metadata file.
    pub metadata_path: PathBuf,
    /// Backup metadata.
    pub metadata: BackupMetadata,
}

/// Manages project backups.
pub struct BackupManager {
    config: BackupConfig,
}

impl BackupManager {
    /// Creates a new BackupManager with the given configuration.
    pub fn new(config: BackupConfig) -> io::Result<Self> {
        // Ensure backup directory exists
        fs::create_dir_all(&config.backup_dir)?;
        Ok(Self { config })
    }

    /// Creates a backup of the project data.
    pub fn create_backup(&self, project_data: &BackupProjectData) -> io::Result<PathBuf> {
        let timestamp = Utc::now();
        let timestamp_str = timestamp.format("%Y%m%d_%H%M%S_%6f").to_string();
        let backup_filename = format!("backup_{}_{}.json", project_data.id, timestamp_str);
        let backup_path = self.config.backup_dir.join(&backup_filename);
        let metadata_path = self.config.backup_dir.join(format!("{}.meta", backup_filename));

        // Serialize project data
        let json_data = serde_json::to_string_pretty(project_data)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        // Compute checksum
        let mut hasher = Sha256::new();
        hasher.update(json_data.as_bytes());
        let checksum = format!("{:x}", hasher.finalize());

        // Write backup file
        fs::write(&backup_path, &json_data)?;

        // Get file size
        let file_size = fs::metadata(&backup_path)?.len();

        // Create and write metadata
        let metadata = BackupMetadata {
            created_at: timestamp,
            project_name: project_data.name.clone(),
            file_size,
            checksum,
        };

        let metadata_json = serde_json::to_string_pretty(&metadata)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(&metadata_path, metadata_json)?;

        // Perform rotation
        self.rotate_backups(&project_data.id)?;

        Ok(backup_path)
    }

    /// Rotates backups, keeping only the most recent max_backups.
    fn rotate_backups(&self, project_id: &str) -> io::Result<()> {
        let mut backups = self.list_backups(project_id)?;

        // If we're within limit, nothing to do
        if backups.len() <= self.config.max_backups {
            return Ok(());
        }

        // Sort by timestamp (oldest first)
        backups.sort_by_key(|b| b.timestamp);

        // Delete oldest backups
        let to_delete = backups.len() - self.config.max_backups;
        for backup in backups.iter().take(to_delete) {
            // Remove backup file
            if backup.backup_path.exists() {
                fs::remove_file(&backup.backup_path)?;
            }
            // Remove metadata file
            if backup.metadata_path.exists() {
                fs::remove_file(&backup.metadata_path)?;
            }
        }

        Ok(())
    }

    /// Lists all backups for a project, sorted by date (newest first).
    pub fn list_backups(&self, project_id: &str) -> io::Result<Vec<BackupInfo>> {
        let mut backups = Vec::new();

        if !self.config.backup_dir.exists() {
            return Ok(backups);
        }

        let pattern_prefix = format!("backup_{}_", project_id);

        for entry in fs::read_dir(&self.config.backup_dir)? {
            let entry = entry?;
            let path = entry.path();

            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                // Only process .json backup files
                if !filename.starts_with(&pattern_prefix) || !filename.ends_with(".json") {
                    continue;
                }

                // Parse timestamp from filename
                // Format: backup_{project_id}_{timestamp}.json
                if let Some(timestamp_str) = filename
                    .strip_prefix(&pattern_prefix)
                    .and_then(|s| s.strip_suffix(".json"))
                {
                    // Parse as naive datetime first, then convert to UTC
                    if let Ok(naive_dt) = chrono::NaiveDateTime::parse_from_str(
                        timestamp_str,
                        "%Y%m%d_%H%M%S_%6f",
                    ) {
                        let timestamp = DateTime::<Utc>::from_naive_utc_and_offset(naive_dt, Utc);
                        let metadata_path = self
                            .config
                            .backup_dir
                            .join(format!("{}.meta", filename));

                        // Try to read metadata
                        if let Ok(metadata_content) = fs::read_to_string(&metadata_path) {
                            if let Ok(metadata) =
                                serde_json::from_str::<BackupMetadata>(&metadata_content)
                            {
                                backups.push(BackupInfo {
                                    project_id: project_id.to_string(),
                                    timestamp: timestamp.with_timezone(&Utc),
                                    backup_path: path,
                                    metadata_path,
                                    metadata,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort by timestamp (newest first)
        backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(backups)
    }

    /// Gets the latest backup for a project.
    pub fn get_latest_backup(&self, project_id: &str) -> io::Result<Option<BackupInfo>> {
        let backups = self.list_backups(project_id)?;
        Ok(backups.into_iter().next())
    }

    /// Restores project data from a backup file.
    pub fn restore_from_backup(&self, backup_path: &Path) -> io::Result<BackupProjectData> {
        let content = fs::read_to_string(backup_path)?;
        let project_data = serde_json::from_str(&content)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        Ok(project_data)
    }

    /// Verifies the integrity of a backup by checking its checksum.
    pub fn verify_backup(&self, backup_info: &BackupInfo) -> io::Result<bool> {
        // Read backup file
        let content = fs::read(&backup_info.backup_path)?;

        // Compute checksum
        let mut hasher = Sha256::new();
        hasher.update(&content);
        let computed_checksum = format!("{:x}", hasher.finalize());

        // Compare with stored checksum
        Ok(computed_checksum == backup_info.metadata.checksum)
    }

    /// Validates the structure of a backup by attempting to deserialize it.
    pub fn validate_backup_structure(&self, backup_path: &Path) -> io::Result<bool> {
        match self.restore_from_backup(backup_path) {
            Ok(data) => {
                // Check required fields are present and not empty
                Ok(!data.id.is_empty() && !data.name.is_empty())
            }
            Err(_) => Ok(false),
        }
    }

    /// Detects if there's a stale lock file indicating an incomplete save.
    pub fn detect_crash(&self, project_id: &str) -> io::Result<bool> {
        let lock_path = self.config.backup_dir.join(format!("{}.lock", project_id));
        Ok(lock_path.exists())
    }

    /// Creates a lock file to indicate an ongoing save operation.
    pub fn create_lock(&self, project_id: &str) -> io::Result<()> {
        let lock_path = self.config.backup_dir.join(format!("{}.lock", project_id));
        fs::write(lock_path, "")?;
        Ok(())
    }

    /// Removes a lock file after a successful save operation.
    pub fn remove_lock(&self, project_id: &str) -> io::Result<()> {
        let lock_path = self.config.backup_dir.join(format!("{}.lock", project_id));
        if lock_path.exists() {
            fs::remove_file(lock_path)?;
        }
        Ok(())
    }

    /// Recovers from a crash by finding the latest valid backup.
    pub fn recover_from_crash(&self, project_id: &str) -> io::Result<Option<BackupProjectData>> {
        if !self.detect_crash(project_id)? {
            return Ok(None);
        }

        // Find latest backup
        if let Some(backup_info) = self.get_latest_backup(project_id)? {
            // Verify backup integrity
            if self.verify_backup(&backup_info)? {
                let data = self.restore_from_backup(&backup_info.backup_path)?;
                // Clean up lock file
                self.remove_lock(project_id)?;
                return Ok(Some(data));
            }
        }

        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_project_data() -> BackupProjectData {
        BackupProjectData {
            id: "test-project-123".to_string(),
            name: "Test Project".to_string(),
            data: serde_json::json!({
                "version": "1.0",
                "layers": ["layer1", "layer2"]
            }),
        }
    }

    fn create_test_manager() -> (BackupManager, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let config = BackupConfig {
            backup_dir: temp_dir.path().to_path_buf(),
            max_backups: 10,
        };
        let manager = BackupManager::new(config).unwrap();
        (manager, temp_dir)
    }

    #[test]
    fn test_create_backup_creates_files() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        let backup_path = manager.create_backup(&project_data).unwrap();

        // Verify backup file exists
        assert!(backup_path.exists());

        // Verify metadata file exists
        let metadata_path = backup_path.with_extension("json.meta");
        assert!(metadata_path.exists());
    }

    #[test]
    fn test_create_backup_contains_correct_data() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        let backup_path = manager.create_backup(&project_data).unwrap();

        // Read and verify content
        let content = fs::read_to_string(&backup_path).unwrap();
        let restored: BackupProjectData = serde_json::from_str(&content).unwrap();

        assert_eq!(restored, project_data);
    }

    #[test]
    fn test_backup_filename_format() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        let backup_path = manager.create_backup(&project_data).unwrap();
        let filename = backup_path.file_name().unwrap().to_str().unwrap();

        // Should match pattern: backup_{project_id}_{timestamp}.json
        assert!(filename.starts_with("backup_test-project-123_"));
        assert!(filename.ends_with(".json"));
    }

    #[test]
    fn test_backup_metadata_has_required_fields() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        let backup_path = manager.create_backup(&project_data).unwrap();
        let metadata_path = backup_path.with_extension("json.meta");

        let metadata_content = fs::read_to_string(&metadata_path).unwrap();
        let metadata: BackupMetadata = serde_json::from_str(&metadata_content).unwrap();

        assert_eq!(metadata.project_name, "Test Project");
        assert!(metadata.file_size > 0);
        assert!(!metadata.checksum.is_empty());
        assert_eq!(metadata.checksum.len(), 64); // SHA-256 hex is 64 chars
    }

    #[test]
    fn test_list_backups_returns_sorted_by_newest_first() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        // Create multiple backups with small delays
        manager.create_backup(&project_data).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        manager.create_backup(&project_data).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));
        manager.create_backup(&project_data).unwrap();

        let backups = manager.list_backups("test-project-123").unwrap();

        assert_eq!(backups.len(), 3);
        // Newest should be first
        assert!(backups[0].timestamp >= backups[1].timestamp);
        assert!(backups[1].timestamp >= backups[2].timestamp);
    }

    #[test]
    fn test_rotation_keeps_max_backups() {
        let temp_dir = TempDir::new().unwrap();
        let config = BackupConfig {
            backup_dir: temp_dir.path().to_path_buf(),
            max_backups: 3,
        };
        let manager = BackupManager::new(config).unwrap();
        let project_data = create_test_project_data();

        // Create 5 backups
        for _ in 0..5 {
            manager.create_backup(&project_data).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        let backups = manager.list_backups("test-project-123").unwrap();

        // Should only have 3 (max_backups)
        assert_eq!(backups.len(), 3);
    }

    #[test]
    fn test_rotation_keeps_newest_backups() {
        let temp_dir = TempDir::new().unwrap();
        let config = BackupConfig {
            backup_dir: temp_dir.path().to_path_buf(),
            max_backups: 2,
        };
        let manager = BackupManager::new(config).unwrap();

        let mut project_data = create_test_project_data();

        // Create backups with different data
        project_data.data = serde_json::json!({"version": "1.0"});
        manager.create_backup(&project_data).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));

        project_data.data = serde_json::json!({"version": "2.0"});
        manager.create_backup(&project_data).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));

        project_data.data = serde_json::json!({"version": "3.0"});
        manager.create_backup(&project_data).unwrap();

        let backups = manager.list_backups("test-project-123").unwrap();

        assert_eq!(backups.len(), 2);

        // Verify newest backups are kept
        let restored1 = manager
            .restore_from_backup(&backups[0].backup_path)
            .unwrap();
        let restored2 = manager
            .restore_from_backup(&backups[1].backup_path)
            .unwrap();

        // Should have version 3.0 and 2.0, not 1.0
        let versions: Vec<String> = [restored1, restored2]
            .iter()
            .map(|d| d.data["version"].as_str().unwrap().to_string())
            .collect();

        assert!(versions.contains(&"3.0".to_string()));
        assert!(versions.contains(&"2.0".to_string()));
        assert!(!versions.contains(&"1.0".to_string()));
    }

    #[test]
    fn test_get_latest_backup() {
        let (manager, _temp_dir) = create_test_manager();
        let mut project_data = create_test_project_data();

        // Create multiple backups
        project_data.data = serde_json::json!({"version": "1.0"});
        manager.create_backup(&project_data).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(10));

        project_data.data = serde_json::json!({"version": "2.0"});
        manager.create_backup(&project_data).unwrap();

        let latest = manager.get_latest_backup("test-project-123").unwrap();

        assert!(latest.is_some());
        let latest = latest.unwrap();

        let restored = manager.restore_from_backup(&latest.backup_path).unwrap();
        assert_eq!(restored.data["version"], "2.0");
    }

    #[test]
    fn test_restore_from_backup() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        let backup_path = manager.create_backup(&project_data).unwrap();
        let restored = manager.restore_from_backup(&backup_path).unwrap();

        assert_eq!(restored, project_data);
    }

    #[test]
    fn test_verify_backup_with_valid_checksum() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        manager.create_backup(&project_data).unwrap();
        let backups = manager.list_backups("test-project-123").unwrap();

        let is_valid = manager.verify_backup(&backups[0]).unwrap();
        assert!(is_valid);
    }

    #[test]
    fn test_verify_backup_detects_corruption() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        let backup_path = manager.create_backup(&project_data).unwrap();

        // Corrupt the backup file
        fs::write(&backup_path, "corrupted data").unwrap();

        let backups = manager.list_backups("test-project-123").unwrap();
        let is_valid = manager.verify_backup(&backups[0]).unwrap();

        assert!(!is_valid);
    }

    #[test]
    fn test_validate_backup_structure_valid() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        let backup_path = manager.create_backup(&project_data).unwrap();
        let is_valid = manager.validate_backup_structure(&backup_path).unwrap();

        assert!(is_valid);
    }

    #[test]
    fn test_validate_backup_structure_invalid_json() {
        let (manager, temp_dir) = create_test_manager();

        let invalid_path = temp_dir.path().join("invalid.json");
        fs::write(&invalid_path, "not valid json").unwrap();

        let is_valid = manager.validate_backup_structure(&invalid_path).unwrap();
        assert!(!is_valid);
    }

    #[test]
    fn test_validate_backup_structure_missing_fields() {
        let (manager, temp_dir) = create_test_manager();

        let incomplete_path = temp_dir.path().join("incomplete.json");
        fs::write(&incomplete_path, r#"{"id":"","name":"","data":{}}"#).unwrap();

        let is_valid = manager.validate_backup_structure(&incomplete_path).unwrap();
        assert!(!is_valid); // Empty id/name should fail validation
    }

    #[test]
    fn test_detect_crash_no_lock_file() {
        let (manager, _temp_dir) = create_test_manager();

        let has_crash = manager.detect_crash("test-project-123").unwrap();
        assert!(!has_crash);
    }

    #[test]
    fn test_detect_crash_with_lock_file() {
        let (manager, _temp_dir) = create_test_manager();

        manager.create_lock("test-project-123").unwrap();
        let has_crash = manager.detect_crash("test-project-123").unwrap();

        assert!(has_crash);
    }

    #[test]
    fn test_create_and_remove_lock() {
        let (manager, temp_dir) = create_test_manager();

        manager.create_lock("test-project-123").unwrap();
        let lock_path = temp_dir.path().join("test-project-123.lock");
        assert!(lock_path.exists());

        manager.remove_lock("test-project-123").unwrap();
        assert!(!lock_path.exists());
    }

    #[test]
    fn test_recover_from_crash_with_valid_backup() {
        let (manager, _temp_dir) = create_test_manager();
        let project_data = create_test_project_data();

        // Create backup and lock file
        manager.create_backup(&project_data).unwrap();
        manager.create_lock("test-project-123").unwrap();

        let recovered = manager.recover_from_crash("test-project-123").unwrap();

        assert!(recovered.is_some());
        let recovered = recovered.unwrap();
        assert_eq!(recovered, project_data);

        // Lock should be cleaned up
        let has_crash = manager.detect_crash("test-project-123").unwrap();
        assert!(!has_crash);
    }

    #[test]
    fn test_recover_from_crash_no_crash() {
        let (manager, _temp_dir) = create_test_manager();

        let recovered = manager.recover_from_crash("test-project-123").unwrap();
        assert!(recovered.is_none());
    }

    #[test]
    fn test_recover_from_crash_no_backup() {
        let (manager, _temp_dir) = create_test_manager();

        manager.create_lock("test-project-123").unwrap();
        let recovered = manager.recover_from_crash("test-project-123").unwrap();

        assert!(recovered.is_none());
    }
}
