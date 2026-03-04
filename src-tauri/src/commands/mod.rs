//! Tauri command handlers.
//!
//! This module contains all `#[tauri::command]` functions that are
//! invoked from the frontend via Tauri's IPC bridge.

pub mod assets;
pub mod canvas;
pub mod filesystem;
pub mod pdf;
pub mod project;

// Re-export command functions
pub use assets::{delete_asset, generate_thumbnail, import_asset, list_assets, AssetStore};
pub use canvas::{add_element, get_elements, remove_element, update_element, CanvasStore};
pub use filesystem::{create_directory, list_directory, read_text_file, write_text_file};
pub use pdf::export_pdf;
pub use project::{create_project, get_project_info, load_project, save_project, ProjectStore};

/// Greet command to verify the IPC bridge works.
///
/// Takes a `name` string and returns a greeting message.
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Design Studio Pro.", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greet_returns_expected_message() {
        let result = greet("Alice");
        assert_eq!(result, "Hello, Alice! Welcome to Design Studio Pro.");
    }

    #[test]
    fn greet_handles_empty_name() {
        let result = greet("");
        assert_eq!(result, "Hello, ! Welcome to Design Studio Pro.");
    }
}
