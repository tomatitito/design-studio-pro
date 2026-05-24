pub mod backup;
pub mod commands;
pub mod core;
pub mod error;
pub mod models;
pub mod updater;
pub mod utils;

#[cfg(desktop)]
const CHECK_FOR_UPDATES_MENU_ID: &str = "check_for_updates";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the logger
    env_logger::init();
    log::info!("Design Studio Pro starting...");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(commands::ProjectStore::new())
        .manage(commands::CanvasStore::new())
        .manage(commands::AssetStore::new())
        .setup(|app| {
            #[cfg(desktop)]
            {
                configure_menu(app)?;
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            #[cfg(desktop)]
            {
                if event.id().as_ref() == CHECK_FOR_UPDATES_MENU_ID {
                    handle_check_for_updates(app.clone());
                }
            }
        })
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
        ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(desktop)]
fn configure_menu(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, SubmenuBuilder};

    let file_menu = SubmenuBuilder::new(app, "File")
        .text(CHECK_FOR_UPDATES_MENU_ID, "Check for Updates...")
        .separator()
        .close_window()
        .separator()
        .quit()
        .build()?;

    let menu = MenuBuilder::new(app).item(&file_menu).build()?;
    app.set_menu(menu)?;
    Ok(())
}

#[cfg(desktop)]
fn handle_check_for_updates(app: tauri::AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    let version = app.package_info().version.to_string();
    app.dialog()
        .message("Checking for updates...")
        .title("Design Studio Pro")
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::Ok)
        .show(|_| {});

    std::thread::spawn(move || {
        let runtime = match tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        {
            Ok(runtime) => runtime,
            Err(error) => {
                show_update_error(&app, &format!("Failed to initialize updater: {error}"));
                return;
            }
        };

        match runtime.block_on(updater::check_for_updates(&version, true)) {
            Ok(updater::CheckOutcome::UpToDate { .. }) => {
                app.dialog()
                    .message(format!("Design Studio Pro {version} is up to date."))
                    .title("Design Studio Pro")
                    .kind(MessageDialogKind::Info)
                    .buttons(MessageDialogButtons::Ok)
                    .blocking_show();
            }
            Ok(updater::CheckOutcome::UpdateAvailable {
                current_version,
                latest_version,
                official_install,
                ..
            }) => {
                if !official_install {
                    app.dialog()
                        .message(format!(
                            "Design Studio Pro {latest_version} is available, but automatic installation is supported only for official installs.\n\nCurrent version: {current_version}"
                        ))
                        .title("Update Available")
                        .kind(MessageDialogKind::Warning)
                        .buttons(MessageDialogButtons::Ok)
                        .blocking_show();
                    return;
                }

                let should_install = app
                    .dialog()
                    .message(format!(
                        "Design Studio Pro {latest_version} is available.\n\nCurrent version: {current_version}\n\nInstall it now?"
                    ))
                    .title("Update Available")
                    .kind(MessageDialogKind::Info)
                    .buttons(MessageDialogButtons::OkCancelCustom(
                        "Install".to_string(),
                        "Cancel".to_string(),
                    ))
                    .blocking_show();

                if !should_install {
                    return;
                }

                match runtime.block_on(updater::self_update(&version)) {
                    Ok(updater::InstallOutcome::UpToDate { .. }) => {
                        app.dialog()
                            .message(format!("Design Studio Pro {version} is up to date."))
                            .title("Design Studio Pro")
                            .kind(MessageDialogKind::Info)
                            .buttons(MessageDialogButtons::Ok)
                            .blocking_show();
                    }
                    Ok(updater::InstallOutcome::Installed { new_version, .. })
                    | Ok(updater::InstallOutcome::StagedWindowsReplacement {
                        new_version, ..
                    }) => {
                        app.dialog()
                            .message(format!(
                                "Design Studio Pro was updated to {new_version}. Restart the app to use the new version."
                            ))
                            .title("Update Installed")
                            .kind(MessageDialogKind::Info)
                            .buttons(MessageDialogButtons::Ok)
                            .blocking_show();
                    }
                    Err(error) => {
                        show_update_error(&app, &format!("Failed to install update: {error}"));
                    }
                }
            }
            Err(error) => {
                show_update_error(&app, &format!("Failed to check for updates: {error}"));
            }
        }
    });
}

#[cfg(desktop)]
fn show_update_error(app: &tauri::AppHandle, message: &str) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    app.dialog()
        .message(message)
        .title("Design Studio Pro")
        .kind(MessageDialogKind::Error)
        .buttons(MessageDialogButtons::Ok)
        .blocking_show();
}
