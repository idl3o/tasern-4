use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use std::time::Duration;
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub installed: bool,
    pub running: bool,
    pub models: Vec<String>,
}

/// Shared HTTP client (connection pooling) instead of one per request.
fn http() -> &'static reqwest::Client {
    static HTTP: OnceLock<reqwest::Client> = OnceLock::new();
    HTTP.get_or_init(reqwest::Client::new)
}

/// Validate a model name before passing it to `ollama pull` to avoid argument
/// injection (a leading '-' would be read as a flag) and stray characters.
fn is_valid_model_name(model: &str) -> bool {
    !model.is_empty()
        && !model.starts_with('-')
        && model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | ':' | '/' | '-'))
}

/// Check if Ollama is installed on the system
#[tauri::command]
async fn check_ollama_installed() -> Result<bool, String> {
    // Try to run 'ollama --version' to check if installed (async, non-blocking)
    match Command::new("ollama").arg("--version").output().await {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Check if Ollama server is running by hitting the API
#[tauri::command]
async fn check_ollama_running() -> Result<bool, String> {
    let result = http()
        .get("http://localhost:11434/api/tags")
        .timeout(Duration::from_secs(2))
        .send()
        .await;

    match result {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Start Ollama server
#[tauri::command]
async fn start_ollama() -> Result<(), String> {
    // Don't spawn a second server if one is already up (avoids orphaned duplicates).
    if check_ollama_running().await.unwrap_or(false) {
        return Ok(());
    }

    // On Windows, 'ollama serve' runs in foreground; spawn it detached.
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        Command::new("ollama")
            .arg("serve")
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("ollama")
            .arg("serve")
            .spawn()
            .map_err(|e| format!("Failed to start Ollama: {}", e))?;
    }

    // Poll for readiness (up to ~10s) instead of a blind fixed sleep.
    for _ in 0..20 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        if check_ollama_running().await.unwrap_or(false) {
            return Ok(());
        }
    }

    Err("Ollama was started but did not become ready in time".to_string())
}

/// List available models
#[tauri::command]
async fn list_models() -> Result<Vec<String>, String> {
    let response = http()
        .get("http://localhost:11434/api/tags")
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let models = body["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m["name"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}

/// Check if a specific model is available
#[tauri::command]
async fn has_model(model: String) -> Result<bool, String> {
    let models = list_models().await?;
    Ok(models.iter().any(|m| m.starts_with(&model)))
}

/// Pull a model (this can take a while)
#[tauri::command]
async fn pull_model(model: String) -> Result<(), String> {
    if !is_valid_model_name(&model) {
        return Err(format!("Invalid model name: {}", model));
    }

    // Async output() so the multi-minute pull doesn't block a tokio worker thread.
    let output = Command::new("ollama")
        .arg("pull")
        .arg(&model)
        .output()
        .await
        .map_err(|e| format!("Failed to pull model: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to pull model: {}", stderr))
    }
}

/// Get full Ollama status
#[tauri::command]
async fn get_ollama_status() -> Result<OllamaStatus, String> {
    let installed = check_ollama_installed().await.unwrap_or(false);
    let running = check_ollama_running().await.unwrap_or(false);
    let models = if running {
        list_models().await.unwrap_or_default()
    } else {
        vec![]
    };

    Ok(OllamaStatus {
        installed,
        running,
        models,
    })
}

/// Open Ollama download page in browser
#[tauri::command]
async fn open_ollama_download() -> Result<(), String> {
    open::that("https://ollama.ai/download").map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_ollama_installed,
            check_ollama_running,
            start_ollama,
            list_models,
            has_model,
            pull_model,
            get_ollama_status,
            open_ollama_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
