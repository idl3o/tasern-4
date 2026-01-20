use serde::{Deserialize, Serialize};
use std::process::Command;

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

/// Check if Ollama is installed on the system
#[tauri::command]
async fn check_ollama_installed() -> Result<bool, String> {
    // Try to run 'ollama --version' to check if installed
    let output = Command::new("ollama")
        .arg("--version")
        .output();

    match output {
        Ok(out) => Ok(out.status.success()),
        Err(_) => Ok(false),
    }
}

/// Check if Ollama server is running by hitting the API
#[tauri::command]
async fn check_ollama_running() -> Result<bool, String> {
    let client = reqwest::Client::new();
    let result = client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(2))
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
    // On Windows, 'ollama serve' runs in foreground
    // We spawn it detached so it runs in background
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
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

    // Wait a moment for server to start
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    Ok(())
}

/// List available models
#[tauri::command]
async fn list_models() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/tags")
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
    let output = Command::new("ollama")
        .arg("pull")
        .arg(&model)
        .output()
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
        .plugin(tauri_plugin_shell::init())
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
