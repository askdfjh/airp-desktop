#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::header::{HeaderMap, HeaderName, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, CONTENT_TYPE};
use reqwest::cookie::{Jar, CookieStore};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use url::Url;

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

#[derive(Deserialize)]
struct SetCookieArgs {
    url: String,
    name: String,
    value: String,
    #[serde(default)]
    domain: Option<String>,
    #[serde(default)]
    path: Option<String>,
}

#[derive(Deserialize)]
struct ClearCookieArgs {
    #[serde(default)]
    domain: Option<String>,
}

static COOKIE_JAR: OnceLock<Arc<Jar>> = OnceLock::new();
static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_cookie_jar() -> &'static Arc<Jar> {
    COOKIE_JAR.get_or_init(|| Arc::new(Jar::default()))
}

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        let jar = get_cookie_jar().clone();
        let builder = reqwest::Client::builder()
            .cookie_provider(jar)
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
            .default_headers({
                let mut h = HeaderMap::new();
                h.insert(ACCEPT, HeaderValue::from_static(
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
                ));
                h.insert(ACCEPT_LANGUAGE, HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8"));
                h.insert("Cache-Control", HeaderValue::from_static("no-cache"));
                h.insert("Pragma", HeaderValue::from_static("no-cache"));
                h
            });

        builder.build().expect("failed to build HTTP client")
    })
}

fn build_set_cookie(name: &str, value: &str, domain: Option<&str>, path: Option<&str>) -> String {
    let mut s = format!("{}={}", name, value);
    if let Some(d) = domain {
        s.push_str(&format!("; Domain={}", d));
    }
    if let Some(p) = path {
        s.push_str(&format!("; Path={}", p));
    }
    s
}

#[tauri::command]
async fn http_fetch(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<String, String> {
    let client = get_http_client();
    let method = method.unwrap_or_default();
    let headers = headers.unwrap_or_default();

    if let Ok(parsed_url) = Url::parse(&url) {
        let domain = parsed_url.domain().unwrap_or("");
        let sent = get_cookie_jar().cookies(&parsed_url);
        let sent_count = sent.as_ref().map(|v| v.as_bytes().split(|&b| b == b';').count()).unwrap_or(0);
        println!("[http_fetch] -> {} | domain={} | cookies_sent={}",
                 &url.chars().take(100).collect::<String>(),
                 domain, sent_count);
    }

    let method = match method.to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        _ => reqwest::Method::GET,
    };

    let mut req = client.request(method, &url);
    for (key, value) in &headers {
        if key.eq_ignore_ascii_case("cookie") {
            println!("[http_fetch] Ignoring user-supplied Cookie header");
            continue;
        }
        if let Ok(name) = key.parse::<HeaderName>() {
            if let Ok(val) = HeaderValue::from_str(value) {
                req = req.header(name, val);
            }
        }
    }

    if let Some(ref b) = body {
        if !headers.keys().any(|k| k.eq_ignore_ascii_case("content-type")) {
            req = req.header(CONTENT_TYPE, "application/json");
        }
        req = req.body(b.clone());
    }

    let resp = req.send().await.map_err(|e| format!("请求失败: {}", e))?;
    let status = resp.status();

    if let Ok(parsed_url) = Url::parse(&url) {
        let after = get_cookie_jar().cookies(&parsed_url);
        let after_count = after.as_ref().map(|v| v.as_bytes().split(|&b| b == b';').count()).unwrap_or(0);
        println!("[http_fetch] <- {} | status={} | cookies_now={}",
                 parsed_url.domain().unwrap_or("?"), status, after_count);
        if after_count > 0 {
            let snippet: String = after.as_ref().unwrap().as_bytes().iter().map(|&b| b as char).take(120).collect();
            println!("[http_fetch]    cookie snippet: {}", snippet);
        }
    }

    if !status.is_success() {
        let body_text = resp.text().await.unwrap_or_default();
        let snippet: String = body_text.chars().take(500).collect();
        return Err(format!("HTTP {}: {}", status, snippet));
    }

    resp.text().await.map_err(|e| format!("读取响应失败: {}", e))
}

#[tauri::command]
fn http_set_cookie(args: SetCookieArgs) -> Result<String, String> {
    let parsed_url = Url::parse(&args.url).map_err(|e| format!("无效 URL: {}", e))?;
    let domain = args.domain.clone().or_else(|| parsed_url.domain().map(|s| s.to_string()));
    let set_cookie = build_set_cookie(
        &args.name,
        &args.value,
        domain.as_deref(),
        args.path.as_deref(),
    );
    let jar = get_cookie_jar();
    jar.add_cookie_str(&set_cookie, &parsed_url);
    let after = jar.cookies(&parsed_url);
    let count = after.as_ref().map(|v| v.as_bytes().split(|&b| b == b';').count()).unwrap_or(0);
    println!("[http_set_cookie] Set {}={} for {} | now={} cookies",
             args.name, args.value.chars().take(40).collect::<String>(),
             parsed_url.domain().unwrap_or("?"), count);
    Ok(format!("已为 {} 设置 cookie (当前共 {} 个)", parsed_url.domain().unwrap_or("?"), count))
}

#[tauri::command]
fn http_list_cookies(url: String) -> Result<String, String> {
    let parsed_url = Url::parse(&url).map_err(|e| format!("无效 URL: {}", e))?;
    let jar = get_cookie_jar();
    let cookies = jar.cookies(&parsed_url);
    let mut out = String::new();
    let domain = parsed_url.domain().unwrap_or("?");
    match cookies {
        Some(v) => {
            let mut count = 0usize;
            for part in v.as_bytes().split(|&b| b == b';') {
                let s = String::from_utf8_lossy(part).trim().to_string();
                if !s.is_empty() {
                    out.push_str(&format!("  - {}\n", s.chars().take(120).collect::<String>()));
                    count += 1;
                }
            }
            if count == 0 {
                out.push_str("  (empty)\n");
            }
            out.insert_str(0, &format!("domain={} | count={}\n", domain, count));
        }
        None => {
            out = format!("domain={} | count=0\n  (none)\n", domain);
        }
    }
    println!("[http_list_cookies] {}", out);
    Ok(out)
}

#[tauri::command]
fn http_clear_cookies(args: ClearCookieArgs) -> Result<String, String> {
    let jar = get_cookie_jar();
    let domains: Vec<String> = match args.domain {
        Some(d) if !d.is_empty() => {
            let d = d.trim().trim_start_matches('.').to_string();
            vec![format!("https://{}", d), format!("https://www.{}", d)]
        }
        _ => vec![
            "https://duckduckgo.com".into(),
            "https://www.duckduckgo.com".into(),
            "https://bing.com".into(),
            "https://www.bing.com".into(),
            "https://google.com".into(),
            "https://www.google.com".into(),
        ],
    };
    let mut total = 0usize;
    for durl in &domains {
        if let Ok(u) = Url::parse(durl) {
            let before = jar.cookies(&u)
                .map(|v| v.as_bytes().split(|&b| b == b';').count())
                .unwrap_or(0);
            for name in ["__Secure", "_xsrf", "uid", "auth", "token"] {
                jar.add_cookie_str(&format!("{}=; Max-Age=0; Path=/", name), &u);
            }
            let after = jar.cookies(&u)
                .map(|v| v.as_bytes().split(|&b| b == b';').count())
                .unwrap_or(0);
            total += before.saturating_sub(after);
        }
    }
    println!("[http_clear_cookies] Cleared {} cookies across {} domains", total, domains.len());
    Ok(format!("已清除约 {} 个 cookie", total))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            http_fetch,
            http_set_cookie,
            http_list_cookies,
            http_clear_cookies,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
