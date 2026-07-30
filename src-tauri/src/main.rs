#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::header::{HeaderMap, HeaderName, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, USER_AGENT, CONTENT_LENGTH, CONTENT_TYPE};
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize)]
struct FetchArgs {
    url: String,
    #[serde(default)]
    method: String,
    #[serde(default)]
    headers: HashMap<String, String>,
    #[serde(default)]
    body: Option<String>,
}

#[tauri::command]
async fn http_fetch(args: FetchArgs) -> Result<String, String> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ));
    headers.insert(ACCEPT, HeaderValue::from_static(
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    ));
    headers.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8"));
    headers.insert("Cache-Control", HeaderValue::from_static("no-cache"));
    headers.insert("Pragma", HeaderValue::from_static("no-cache"));

    // Apply custom headers from args
    for (key, value) in &args.headers {
        if let Ok(name) = key.parse::<HeaderName>() {
            if let Ok(val) = HeaderValue::from_str(value) {
                headers.insert(name, val);
            }
        }
    }

    let method = match args.method.to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        _ => reqwest::Method::GET,
    };

    let has_body = args.body.is_some();
    if has_body && !headers.contains_key(CONTENT_TYPE) {
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    }
    if has_body {
        // Ensure content-length header is set for POST/PUT
        if !headers.contains_key(CONTENT_LENGTH) {
            if let Some(ref body) = args.body {
                let len_str = body.len().to_string();
                if let Ok(hv) = HeaderValue::from_str(&len_str) {
                    headers.insert(CONTENT_LENGTH, hv);
                }
            }
        }
    }

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.request(method, &args.url);

    if let Some(body) = args.body {
        req = req.body(body);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(500).collect();
        return Err(format!("HTTP {}: {}", status, snippet));
    }

    resp.text().await.map_err(|e| format!("读取响应失败: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![http_fetch])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
