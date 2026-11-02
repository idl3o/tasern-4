mod ollama_proxy;

use std::ffi::OsString;
use std::sync::OnceLock;
use std::time::Duration;
use tokio::process::Command;

/// Shared HTTP client (connection pooling) instead of one per request.
pub(crate) fn http() -> &'static reqwest::Client {
    static HTTP: OnceLock<reqwest::Client> = OnceLock::new();
    HTTP.get_or_init(reqwest::Client::new)
}

/// The Ollama binary: where the Windows installer puts it, else whatever is on PATH.
/// A running app doesn't see PATH changes made by an install after it started, so
/// without this "I've installed it - check again" fails until the app restarts.
fn ollama_exe() -> OsString {
    #[cfg(target_os = "windows")]
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let path = std::path::Path::new(&local).join("Programs").join("Ollama").join("ollama.exe");
        if path.is_file() {
            return path.into_os_string();
        }
    }
    OsString::from("ollama")
}

/// Check if Ollama is installed on the system
#[tauri::command]
async fn check_ollama_installed() -> Result<bool, String> {
    // Try to run 'ollama --version' to check if installed (async, non-blocking)
    match Command::new(ollama_exe()).arg("--version").output().await {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Whether the Ollama server answers, used to wait for one we started.
async fn ollama_running() -> bool {
    http()
        .get("http://localhost:11434/api/version")
        .timeout(Duration::from_secs(2))
        .send()
        .await
        .is_ok_and(|response| response.status().is_success())
}

/// Start Ollama server
#[tauri::command]
async fn start_ollama() -> Result<(), String> {
    // Don't spawn a second server if one is already up (avoids orphaned duplicates).
    if ollama_running().await {
        return Ok(());
    }

    // On Windows, 'ollama serve' runs in foreground; spawn it detached.
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        Command::new(ollama_exe())
            .arg("serve")
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new(ollama_exe())
            .arg("serve")
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
    }

    // Poll for readiness (up to ~10s) instead of a blind fixed sleep.
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        if ollama_running().await {
            return Ok(());
        }
    }

    Err("Ollama was started but did not become ready in time".to_string())
}

/// Open Ollama download page in browser
#[tauri::command]
async fn open_ollama_download() -> Result<(), String> {
    open::that("https://ollama.ai/download").map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ollama_proxy::Streams::default())
        .invoke_handler(tauri::generate_handler![
            check_ollama_installed,
            start_ollama,
            open_ollama_download,
            ollama_proxy::ollama_request,
            ollama_proxy::ollama_stream,
            ollama_proxy::ollama_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
