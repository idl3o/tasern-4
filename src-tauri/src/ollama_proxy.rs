//! Proxy between the WebView and the local Ollama server.
//!
//! The packaged Windows app is served from `http://tauri.localhost`, an origin
//! Ollama's default CORS policy refuses (403). Requests made here carry no Origin
//! header, so they are never refused. The proxy is a dumb pipe: it relays status and
//! body text, and splits streams into lines; parsing stays in TypeScript.

use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::State;
use tokio::task::AbortHandle;

/// Where to reach Ollama: OLLAMA_HOST read as Ollama's own CLI reads it, else
/// 127.0.0.1:11434. Read once; the app sees the environment it was started with.
pub(crate) fn ollama_base() -> &'static str {
    static BASE: OnceLock<String> = OnceLock::new();
    BASE.get_or_init(|| base_from_env(std::env::var("OLLAMA_HOST").ok().as_deref()))
}

/// "host:port" or "[v6]:port" (host may be empty); None when there is no port.
fn split_host_port(s: &str) -> Option<(&str, &str)> {
    if let Some(rest) = s.strip_prefix('[') {
        let (host, after) = rest.split_once(']')?;
        return Some((host, after.strip_prefix(':')?));
    }
    let (host, port) = s.rsplit_once(':')?;
    if host.contains(':') {
        return None; // a bare IPv6 address, no port
    }
    Some((host, port))
}

/// Mirrors Ollama's envconfig.Host: no scheme means http on 11434, an explicit
/// http/https without a port means 80/443, and an invalid port falls back to the
/// default. A bind-all address (0.0.0.0, ::) is reached through loopback.
fn base_from_env(value: Option<&str>) -> String {
    let raw = value.map(str::trim).unwrap_or("");
    let (scheme, rest, default_port) = match raw.split_once("://") {
        None => ("http", raw, "11434"),
        Some(("https", rest)) => ("https", rest, "443"),
        Some((scheme, rest)) => (scheme, rest, if scheme == "http" { "80" } else { "11434" }),
    };
    let hostport = rest.split('/').next().unwrap_or("");
    let (host, port) = split_host_port(hostport).unwrap_or((hostport, default_port));
    let port = port.parse::<u16>().map_or(default_port.to_string(), |p| p.to_string());
    let host = match host.trim_matches(|c| c == '[' || c == ']') {
        "" | "0.0.0.0" => "127.0.0.1".to_string(),
        "::" => "[::1]".to_string(),
        v6 if v6.contains(':') => format!("[{v6}]"),
        other => other.to_string(),
    };
    format!("{scheme}://{host}:{port}")
}

/// Only these endpoints are reachable, so the proxy can't be pointed elsewhere.
const ALLOWED_PATHS: &[&str] = &["/api/version", "/api/tags", "/api/show", "/api/chat", "/api/pull"];

fn endpoint(path: &str) -> Result<String, String> {
    if ALLOWED_PATHS.contains(&path) {
        Ok(format!("{}{path}", ollama_base()))
    } else {
        Err(format!("path not allowed: {path}"))
    }
}

#[derive(Serialize)]
pub struct ProxyReply {
    status: u16,
    body: String,
}

/// Sent over a stream's channel: any number of lines, then exactly one `End`.
#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum StreamMessage {
    Line { line: String },
    End { status: u16, body: String },
}

/// In-flight streams by caller-chosen id, so `ollama_cancel` can stop one.
#[derive(Default)]
pub struct Streams(Mutex<HashMap<u32, AbortHandle>>);

/// Removes and returns every complete line in `buf`, leaving any partial tail.
/// Splitting on b'\n' is UTF-8 safe: that byte never occurs inside a multi-byte character.
fn drain_lines(buf: &mut Vec<u8>) -> Vec<String> {
    let mut lines = Vec::new();
    while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
        let raw: Vec<u8> = buf.drain(..=pos).collect();
        let line = String::from_utf8_lossy(&raw).trim().to_string();
        if !line.is_empty() {
            lines.push(line);
        }
    }
    lines
}

/// GET (no body) or POST a JSON endpoint and return its status and body text.
#[tauri::command]
pub async fn ollama_request(path: String, body: Option<serde_json::Value>) -> Result<ProxyReply, String> {
    let url = endpoint(&path)?;
    let request = match body {
        Some(json) => crate::http().post(url).json(&json),
        None => crate::http().get(url),
    };
    let response = request
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("unreachable: {e}"))?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| e.to_string())?;
    Ok(ProxyReply { status, body })
}

async fn pump(url: String, body: serde_json::Value, channel: Channel<StreamMessage>) -> Result<(), String> {
    let mut response = crate::http()
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("unreachable: {e}"))?;
    let status = response.status().as_u16();
    let send = |message: StreamMessage| channel.send(message).map_err(|e| e.to_string());

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        return send(StreamMessage::End { status, body });
    }
    let mut buf = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        buf.extend_from_slice(&chunk);
        for line in drain_lines(&mut buf) {
            send(StreamMessage::Line { line })?;
        }
    }
    let tail = String::from_utf8_lossy(&buf).trim().to_string();
    if !tail.is_empty() {
        send(StreamMessage::Line { line: tail })?;
    }
    send(StreamMessage::End { status, body: String::new() })
}

/// POST and relay the NDJSON response over `on_line`. Resolves once the stream ends;
/// rejects with "unreachable: …" if Ollama can't be reached, or "aborted" if cancelled.
#[tauri::command]
pub async fn ollama_stream(
    id: u32,
    path: String,
    body: serde_json::Value,
    on_line: Channel<StreamMessage>,
    streams: State<'_, Streams>,
) -> Result<(), String> {
    let url = endpoint(&path)?;
    let task = tokio::spawn(pump(url, body, on_line));
    streams.0.lock().map_err(|e| e.to_string())?.insert(id, task.abort_handle());
    let outcome = task.await;
    streams.0.lock().map_err(|e| e.to_string())?.remove(&id);
    match outcome {
        Ok(result) => result,
        Err(e) if e.is_cancelled() => Err("aborted".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

/// Stops an in-flight stream; dropping the connection stops Ollama generating.
#[tauri::command]
pub fn ollama_cancel(id: u32, streams: State<'_, Streams>) -> Result<(), String> {
    if let Some(handle) = streams.0.lock().map_err(|e| e.to_string())?.remove(&id) {
        handle.abort();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drains_complete_lines_and_keeps_the_tail() {
        let mut buf = b"{\"a\":1}\n\n{\"b\":2}\n{\"c\"".to_vec();
        assert_eq!(drain_lines(&mut buf), vec!["{\"a\":1}", "{\"b\":2}"]);
        assert_eq!(buf, b"{\"c\"".to_vec());
    }

    #[test]
    fn keeps_multibyte_characters_split_across_chunks() {
        let text = "{\"content\":\"é\"}\n".as_bytes();
        let split = text.iter().position(|&b| b == 0xC3).unwrap() + 1; // inside "é"
        let mut buf = text[..split].to_vec();
        assert!(drain_lines(&mut buf).is_empty());
        buf.extend_from_slice(&text[split..]);
        assert_eq!(drain_lines(&mut buf), vec!["{\"content\":\"é\"}"]);
    }

    #[test]
    fn reads_ollama_host_like_the_ollama_cli() {
        let cases = [
            (None, "http://127.0.0.1:11434"),
            (Some(""), "http://127.0.0.1:11434"),
            (Some("0.0.0.0"), "http://127.0.0.1:11434"),
            (Some("0.0.0.0:11435"), "http://127.0.0.1:11435"),
            (Some(":11500"), "http://127.0.0.1:11500"),
            (Some("myhost:8080"), "http://myhost:8080"),
            (Some("http://myhost"), "http://myhost:80"),
            (Some("https://ollama.example/"), "https://ollama.example:443"),
            (Some("[::]:11434"), "http://[::1]:11434"),
            (Some("::1"), "http://[::1]:11434"),
            (Some("host:notaport"), "http://host:11434"),
            (Some("  127.0.0.1:11434  "), "http://127.0.0.1:11434"),
        ];
        for (value, expected) in cases {
            assert_eq!(base_from_env(value), expected, "OLLAMA_HOST={value:?}");
        }
    }

    #[test]
    fn refuses_paths_outside_the_allowlist() {
        assert!(endpoint("/api/chat").is_ok());
        assert!(endpoint("/api/delete").is_err());
        assert!(endpoint("@evil.example/api/chat").is_err());
    }
}
