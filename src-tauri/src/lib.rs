use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

// ---------------------------------------------------------------------------
// Configuration state
// ---------------------------------------------------------------------------

pub struct AppConfig {
    pub api_base: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_base: "http://localhost:9999".to_string(),
        }
    }
}

pub struct ConfigState(pub Mutex<AppConfig>);

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse {
    pub success: bool,
    pub data: serde_json::Value,
    pub error: Option<String>,
}

impl ApiResponse {
    fn ok(data: serde_json::Value) -> Self {
        Self { success: true, data, error: None }
    }

    fn err(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            data: serde_json::Value::Null,
            error: Some(msg.into()),
        }
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Fetch Legion node health from /api/health.
/// Returns the raw JSON response or an error payload.
#[tauri::command]
pub async fn get_status(config: State<'_, ConfigState>) -> Result<ApiResponse, String> {
    let base = {
        let lock = config.0.lock().map_err(|e| e.to_string())?;
        lock.api_base.clone()
    };

    let url = format!("{}/api/health", base);

    match reqwest::get(&url).await {
        Ok(resp) => {
            let status = resp.status();
            match resp.json::<serde_json::Value>().await {
                Ok(body) => Ok(ApiResponse::ok(body)),
                Err(e) => Ok(ApiResponse::err(format!(
                    "HTTP {} — failed to parse response: {}",
                    status, e
                ))),
            }
        }
        Err(e) => Ok(ApiResponse::err(format!("Connection failed: {}", e))),
    }
}

/// Fetch the task list from /api/tasks.
/// Returns an array of task objects or an error payload.
#[tauri::command]
pub async fn get_tasks(config: State<'_, ConfigState>) -> Result<ApiResponse, String> {
    let base = {
        let lock = config.0.lock().map_err(|e| e.to_string())?;
        lock.api_base.clone()
    };

    let url = format!("{}/api/tasks", base);

    match reqwest::get(&url).await {
        Ok(resp) => {
            let status = resp.status();
            match resp.json::<serde_json::Value>().await {
                Ok(body) => Ok(ApiResponse::ok(body)),
                Err(e) => Ok(ApiResponse::err(format!(
                    "HTTP {} — failed to parse response: {}",
                    status, e
                ))),
            }
        }
        Err(e) => Ok(ApiResponse::err(format!("Connection failed: {}", e))),
    }
}

/// Invoke a runner method via the Legion REST API.
///
/// POST /api/invoke
/// Body: { extension, runner, method, params }
#[tauri::command]
pub async fn invoke_runner(
    extension: String,
    runner: String,
    method: String,
    params: serde_json::Value,
    config: State<'_, ConfigState>,
) -> Result<ApiResponse, String> {
    let base = {
        let lock = config.0.lock().map_err(|e| e.to_string())?;
        lock.api_base.clone()
    };

    let url = format!("{}/api/invoke", base);

    let body = serde_json::json!({
        "extension": extension,
        "runner":    runner,
        "method":    method,
        "params":    params,
    });

    let client = reqwest::Client::new();
    match client.post(&url).json(&body).send().await {
        Ok(resp) => {
            let status = resp.status();
            match resp.json::<serde_json::Value>().await {
                Ok(data) => Ok(ApiResponse::ok(data)),
                Err(e) => Ok(ApiResponse::err(format!(
                    "HTTP {} — failed to parse response: {}",
                    status, e
                ))),
            }
        }
        Err(e) => Ok(ApiResponse::err(format!("Request failed: {}", e))),
    }
}

/// Update the Legion API base URL at runtime (no restart required).
#[tauri::command]
pub fn set_api_base(url: String, config: State<'_, ConfigState>) -> Result<(), String> {
    let mut lock = config.0.lock().map_err(|e| e.to_string())?;
    lock.api_base = url;
    Ok(())
}

/// Return the currently configured API base URL.
#[tauri::command]
pub fn get_api_base(config: State<'_, ConfigState>) -> Result<String, String> {
    let lock = config.0.lock().map_err(|e| e.to_string())?;
    Ok(lock.api_base.clone())
}
