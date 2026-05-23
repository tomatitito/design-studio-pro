pub mod backup;
pub mod commands;
pub mod core;
pub mod error;
pub mod models;
#[cfg(feature = "cli")]
pub mod updater;
pub mod utils;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the logger
    env_logger::init();
    log::info!("Design Studio Pro starting...");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(commands::ProjectStore::new())
        .manage(commands::CanvasStore::new())
        .manage(commands::AssetStore::new())
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::log_zustand,
            // Project commands
            commands::project::create_project,
            commands::project::get_project_info,
            commands::project::save_project,
            commands::project::save_project_data,
            commands::project::load_project,
            // Canvas commands
            commands::canvas::add_element,
            commands::canvas::update_element,
            commands::canvas::remove_element,
            commands::canvas::get_elements,
            // Asset commands
            commands::assets::import_asset,
            commands::assets::list_assets,
            commands::assets::delete_asset,
            commands::assets::generate_thumbnail,
            // Filesystem commands
            commands::filesystem::read_text_file,
            commands::filesystem::write_text_file,
            commands::filesystem::create_directory,
            commands::filesystem::list_directory,
            // PDF commands
            commands::pdf::export_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
