//! File system operation commands.

use std::fs;

/// Reads a text file and returns its contents.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))
}

/// Writes content to a text file.
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Failed to write file {}: {}", path, e))
}

/// Creates a directory and all parent directories if needed.
#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory {}: {}", path, e))
}

/// Lists all entries in a directory.
#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory {}: {}", path, e))?;

    let mut result = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path_str = entry
            .path()
            .to_str()
            .ok_or_else(|| "Invalid path encoding".to_string())?
            .to_string();
        result.push(path_str);
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn read_text_file_returns_content() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "Hello, World!").unwrap();

        let result = read_text_file(file_path.to_str().unwrap().to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Hello, World!");
    }

    #[test]
    fn read_text_file_returns_error_for_missing_file() {
        let result = read_text_file("/nonexistent/file.txt".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read file"));
    }

    #[test]
    fn write_text_file_creates_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("output.txt");

        let result = write_text_file(
            file_path.to_str().unwrap().to_string(),
            "Test content".to_string(),
        );

        assert!(result.is_ok());
        assert!(file_path.exists());

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "Test content");
    }

    #[test]
    fn write_text_file_overwrites_existing_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("overwrite.txt");
        fs::write(&file_path, "Original").unwrap();

        let result = write_text_file(
            file_path.to_str().unwrap().to_string(),
            "New content".to_string(),
        );

        assert!(result.is_ok());
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "New content");
    }

    #[test]
    fn write_text_file_returns_error_for_invalid_path() {
        let result = write_text_file(
            "/invalid/path/file.txt".to_string(),
            "content".to_string(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn create_directory_creates_single_directory() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().join("newdir");

        let result = create_directory(dir_path.to_str().unwrap().to_string());
        assert!(result.is_ok());
        assert!(dir_path.exists());
        assert!(dir_path.is_dir());
    }

    #[test]
    fn create_directory_creates_nested_directories() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().join("parent").join("child").join("grandchild");

        let result = create_directory(dir_path.to_str().unwrap().to_string());
        assert!(result.is_ok());
        assert!(dir_path.exists());
        assert!(dir_path.is_dir());
    }

    #[test]
    fn create_directory_succeeds_for_existing_directory() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().join("existing");
        fs::create_dir(&dir_path).unwrap();

        let result = create_directory(dir_path.to_str().unwrap().to_string());
        assert!(result.is_ok());
    }

    #[test]
    fn list_directory_returns_entries() {
        let temp_dir = TempDir::new().unwrap();
        fs::write(temp_dir.path().join("file1.txt"), "content1").unwrap();
        fs::write(temp_dir.path().join("file2.txt"), "content2").unwrap();
        fs::create_dir(temp_dir.path().join("subdir")).unwrap();

        let result = list_directory(temp_dir.path().to_str().unwrap().to_string());
        assert!(result.is_ok());

        let entries = result.unwrap();
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn list_directory_returns_empty_for_empty_directory() {
        let temp_dir = TempDir::new().unwrap();
        let result = list_directory(temp_dir.path().to_str().unwrap().to_string());

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn list_directory_returns_error_for_nonexistent_directory() {
        let result = list_directory("/nonexistent/directory".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Failed to read directory"));
    }

    #[test]
    fn filesystem_operations_work_together() {
        let temp_dir = TempDir::new().unwrap();

        // Create directory
        let dir_path = temp_dir.path().join("testdir");
        create_directory(dir_path.to_str().unwrap().to_string()).unwrap();

        // Write file
        let file_path = dir_path.join("test.txt");
        write_text_file(
            file_path.to_str().unwrap().to_string(),
            "Hello".to_string(),
        )
        .unwrap();

        // Read file
        let content = read_text_file(file_path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(content, "Hello");

        // List directory
        let entries = list_directory(dir_path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(entries.len(), 1);
    }
}
