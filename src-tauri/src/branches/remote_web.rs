//! Opening a remote's web page (the remote editor's Open in browser). Only `http://` and
//! `https://` addresses are opened, and without a user name or password in them, so the window
//! cannot ask the system to open anything else.

use crate::error::{AppError, CommandResult, ErrorCode};

/// Why `url` is not opened, or None when it may be.
fn refused(url: &str) -> Option<&'static str> {
    let Some(rest) = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
    else {
        return Some("Only web addresses (https://…) are opened.");
    };
    let authority = rest.split('/').next().unwrap_or_default();
    if authority.is_empty() || authority.contains('@') {
        return Some("The address has no server, or carries a user name or password.");
    }
    if url.chars().any(|c| c.is_control() || c.is_whitespace()) {
        return Some("The address holds spaces or control characters.");
    }
    None
}

/// Opens `url` in the default browser.
#[tauri::command]
#[specta::specta]
pub async fn open_web_page(url: String) -> CommandResult<()> {
    if let Some(reason) = refused(&url) {
        return Err(AppError::new(ErrorCode::InvalidInput, reason));
    }
    tauri::async_runtime::spawn_blocking(move || tauri_plugin_opener::open_url(url, None::<&str>))
        .await
        .map_err(|error| AppError::new(ErrorCode::Internal, error.to_string()))?
        .map_err(|error| AppError::new(ErrorCode::Io, error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::refused;

    #[test]
    fn opens_only_plain_web_addresses() {
        assert_eq!(refused("https://github.com/owner/repo"), None);
        assert_eq!(refused("http://git.example.com/a"), None);
        for bad in [
            "file:///C:/Windows",
            "https://ada:pw@github.com/x",
            "https://",
            "javascript:alert(1)",
            "https://h/a b",
            "C:\\x.exe",
        ] {
            assert!(refused(bad).is_some(), "{bad}");
        }
    }
}
