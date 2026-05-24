//! Project-related IPC commands.

use crate::commands::assets::AssetStore;
use crate::core::project_io;
use crate::models::{MeasurementUnit, Orientation, Project, ProjectSettings};
use crate::utils::generate_id;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

/// In-memory storage for projects (temporary until persistence is implemented).
pub struct ProjectStore {
    pub(crate) projects: Mutex<Vec<Project>>,
}

impl ProjectStore {
    pub fn new() -> Self {
        ProjectStore {
            projects: Mutex::new(Vec::new()),
        }
    }
}

impl Default for ProjectStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Creates a new project with default settings.
#[tauri::command]
pub fn create_project(name: String, store: State<ProjectStore>) -> Result<Project, String> {
    let now = Utc::now().to_rfc3339();

    let project = Project {
        id: generate_id(),
        name,
        pages: vec![],
        created_at: now.clone(),
        modified_at: now,
        settings: ProjectSettings {
            width: 1920.0,
            height: 1080.0,
            orientation: Orientation::Landscape,
            unit: MeasurementUnit::Px,
        },
    };

    store
        .projects
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?
        .push(project.clone());

    Ok(project)
}

/// Retrieves project information by ID.
#[tauri::command]
pub fn get_project_info(project_id: String, store: State<ProjectStore>) -> Result<Project, String> {
    let projects = store
        .projects
        .lock()
        .map_err(|e| format!("Failed to acquire lock: {}", e))?;

    projects
        .iter()
        .find(|p| p.id == project_id)
        .cloned()
        .ok_or_else(|| format!("Project not found: {}", project_id))
}

/// Result returned from loading a project file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadProjectResult {
    pub project: Project,
    pub assets: Vec<crate::models::Asset>,
    pub extract_dir: String,
}

fn default_project_extract_dir(archive_path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(archive_path.as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    let project_key = Path::new(archive_path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(|stem| {
            stem.chars()
                .map(|ch| {
                    if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                        ch
                    } else {
                        '-'
                    }
                })
                .collect::<String>()
        })
        .filter(|stem| !stem.is_empty())
        .unwrap_or_else(|| "project".to_string());

    std::env::temp_dir()
        .join("design-studio-pro")
        .join("opened-projects")
        .join(format!("{}-{}", project_key, &hash[..12]))
        .to_string_lossy()
        .to_string()
}

/// Saves the current project and its assets to a .dsproj file.
#[tauri::command]
pub fn save_project(
    project_id: String,
    output_path: String,
    project_store: State<ProjectStore>,
    asset_store: State<AssetStore>,
) -> Result<(), String> {
    let projects = project_store
        .projects
        .lock()
        .map_err(|e| format!("Failed to acquire project lock: {}", e))?;

    let project = projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("Project not found: {}", project_id))?;

    let assets = asset_store
        .assets
        .lock()
        .map_err(|e| format!("Failed to acquire asset lock: {}", e))?;

    project_io::save_project(&output_path, project, &assets)
}

/// Saves explicit project data from the frontend to a .dsproj file.
#[tauri::command]
pub fn save_project_data(
    project: Project,
    output_path: String,
    project_store: State<ProjectStore>,
    asset_store: State<AssetStore>,
) -> Result<(), String> {
    let assets = asset_store
        .assets
        .lock()
        .map_err(|e| format!("Failed to acquire asset lock: {}", e))?;

    project_io::save_project(&output_path, &project, &assets)?;

    let mut projects = project_store
        .projects
        .lock()
        .map_err(|e| format!("Failed to acquire project lock: {}", e))?;
    if let Some(existing) = projects.iter_mut().find(|p| p.id == project.id) {
        *existing = project;
    } else {
        projects.push(project);
    }

    Ok(())
}

/// Loads a project from a .dsproj file.
///
/// The `extract_dir` specifies where asset files should be extracted to.
/// Returns the loaded project data and updated asset references.
#[tauri::command]
pub fn load_project(
    archive_path: String,
    extract_dir: Option<String>,
    project_store: State<ProjectStore>,
    asset_store: State<AssetStore>,
) -> Result<LoadProjectResult, String> {
    let extract_dir = extract_dir.unwrap_or_else(|| default_project_extract_dir(&archive_path));
    let loaded = project_io::load_project(&archive_path, &extract_dir)?;

    // Store the loaded project
    let project = loaded.manifest.project.clone();
    let mut projects = project_store
        .projects
        .lock()
        .map_err(|e| format!("Failed to acquire project lock: {}", e))?;
    if let Some(existing) = projects.iter_mut().find(|p| p.id == project.id) {
        *existing = project.clone();
    } else {
        projects.push(project.clone());
    }

    // Store the loaded assets
    let assets = loaded.manifest.assets.clone();
    let mut asset_lock = asset_store
        .assets
        .lock()
        .map_err(|e| format!("Failed to acquire asset lock: {}", e))?;

    asset_lock.retain(|existing| !assets.iter().any(|asset| asset.id == existing.id));
    for asset in &assets {
        asset_lock.push(asset.clone());
    }

    Ok(LoadProjectResult {
        project,
        assets,
        extract_dir: loaded.extract_dir,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper function to create a project directly without using tauri::State
    fn create_project_internal(name: String, store: &ProjectStore) -> Result<Project, String> {
        let now = Utc::now().to_rfc3339();

        let project = Project {
            id: generate_id(),
            name,
            pages: vec![],
            created_at: now.clone(),
            modified_at: now,
            settings: ProjectSettings {
                width: 1920.0,
                height: 1080.0,
                orientation: Orientation::Landscape,
                unit: MeasurementUnit::Px,
            },
        };

        store
            .projects
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?
            .push(project.clone());

        Ok(project)
    }

    fn get_project_info_internal(
        project_id: String,
        store: &ProjectStore,
    ) -> Result<Project, String> {
        let projects = store
            .projects
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;

        projects
            .iter()
            .find(|p| p.id == project_id)
            .cloned()
            .ok_or_else(|| format!("Project not found: {}", project_id))
    }

    #[test]
    fn default_project_extract_dir_is_stable_and_sanitized() {
        let first = default_project_extract_dir("/tmp/My Project!.dsproj");
        let second = default_project_extract_dir("/tmp/My Project!.dsproj");

        assert_eq!(first, second);
        assert!(first.contains("design-studio-pro"));
        assert!(first.contains("My-Project--"));
    }

    #[test]
    fn create_project_returns_valid_project() {
        let store = ProjectStore::new();
        let result = create_project_internal("Test Project".to_string(), &store);

        assert!(result.is_ok());
        let project = result.unwrap();
        assert_eq!(project.name, "Test Project");
        assert!(!project.id.is_empty());
        assert_eq!(project.pages.len(), 0);
    }

    #[test]
    fn create_project_has_default_settings() {
        let store = ProjectStore::new();
        let result = create_project_internal("New Project".to_string(), &store);

        assert!(result.is_ok());
        let project = result.unwrap();
        assert_eq!(project.settings.width, 1920.0);
        assert_eq!(project.settings.height, 1080.0);
        assert_eq!(project.settings.orientation, Orientation::Landscape);
        assert_eq!(project.settings.unit, MeasurementUnit::Px);
    }

    #[test]
    fn create_project_sets_timestamps() {
        let store = ProjectStore::new();
        let result = create_project_internal("Time Test".to_string(), &store);

        assert!(result.is_ok());
        let project = result.unwrap();
        assert!(!project.created_at.is_empty());
        assert!(!project.modified_at.is_empty());
        assert_eq!(project.created_at, project.modified_at);
    }

    #[test]
    fn create_project_stores_in_state() {
        let store = ProjectStore::new();
        let result = create_project_internal("Stored Project".to_string(), &store);

        assert!(result.is_ok());
        let project_id = result.unwrap().id;

        let stored = store.projects.lock().unwrap();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].id, project_id);
    }

    #[test]
    fn get_project_info_returns_existing_project() {
        let store = ProjectStore::new();
        let created = create_project_internal("Find Me".to_string(), &store).unwrap();

        let result = get_project_info_internal(created.id.clone(), &store);
        assert!(result.is_ok());
        let found = result.unwrap();
        assert_eq!(found.id, created.id);
        assert_eq!(found.name, "Find Me");
    }

    #[test]
    fn get_project_info_returns_error_for_nonexistent_project() {
        let store = ProjectStore::new();
        let result = get_project_info_internal("nonexistent".to_string(), &store);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn multiple_projects_can_be_created() {
        let store = ProjectStore::new();

        let p1 = create_project_internal("Project 1".to_string(), &store).unwrap();
        let p2 = create_project_internal("Project 2".to_string(), &store).unwrap();

        assert_ne!(p1.id, p2.id);

        let stored = store.projects.lock().unwrap();
        assert_eq!(stored.len(), 2);
    }
}
