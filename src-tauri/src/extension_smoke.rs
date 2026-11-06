//! Opt-in native-webview integration harness. Not compiled into normal builds.
use std::sync::atomic::{AtomicBool, Ordering};

static TRUST: AtomicBool = AtomicBool::new(false);

pub fn dialog_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("dialog")
        .invoke_handler(|invoke| {
            match invoke.message.command() {
                "open" => invoke.resolver.resolve(std::env::var("DSP_SMOKE_PACKAGE").unwrap()),
                "ask" => invoke.resolver.resolve(TRUST.load(Ordering::SeqCst)),
                _ => return false,
            }
            true
        })
        .build()
}

#[tauri::command]
pub fn extension_smoke_set_trust(trust: bool) {
    TRUST.store(trust, Ordering::SeqCst);
}

pub fn script() -> String {
    let package = std::env::var("DSP_SMOKE_PACKAGE").expect("DSP_SMOKE_PACKAGE required");
    format!(
        "window.__DSP_SMOKE_PACKAGE__ = {}; {}",
        serde_json::to_string(&package).unwrap(),
        include_str!("../../scripts/extension-smoke.js")
    )
}

#[tauri::command]
pub fn extension_smoke_result(app: tauri::AppHandle, result: String) {
    println!("{result}");
    let code = if result.starts_with("PASS:") { 0 } else { 1 };
    app.exit(code);
}
