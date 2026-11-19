//! Moving a password out of a remote's URL into git's credential helper: the URL keeps the
//! user name (`https://ada@host/repo`), the helper gets the password (`git credential approve`,
//! the description on stdin, never on the command line). The password is never logged.

use std::path::Path;

use tokio_util::sync::CancellationToken;

use crate::cli::Git;
use crate::config::ScopedEntry;

/// A URL with a password written into it, split.
#[derive(Clone, PartialEq, Eq)]
pub struct UrlPassword {
    /// The URL without the password (`https://ada@host/repo`).
    pub url: String,
    protocol: String,
    host: String,
    username: String,
    password: String,
}

impl std::fmt::Debug for UrlPassword {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never the password.
        f.debug_struct("UrlPassword")
            .field("url", &self.url)
            .finish_non_exhaustive()
    }
}

/// `url` split when it is `scheme://user:password@host/…`; None otherwise.
pub fn split_password(url: &str) -> Option<UrlPassword> {
    let (protocol, rest) = url.split_once("://")?;
    let end = rest.find('/').unwrap_or(rest.len());
    let (authority, path) = rest.split_at(end);
    let (userinfo, host) = authority.rsplit_once('@')?;
    let (username, password) = userinfo.split_once(':')?;
    if username.is_empty() || password.is_empty() || host.is_empty() {
        return None;
    }
    Some(UrlPassword {
        url: format!("{protocol}://{username}@{host}{path}"),
        protocol: protocol.to_owned(),
        host: host.to_owned(),
        username: percent_decode(username),
        password: percent_decode(password),
    })
}

/// `%40` → `@`, as git reads user names and passwords in URLs.
fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        let hex = bytes
            .get(index + 1..index + 3)
            .and_then(|pair| std::str::from_utf8(pair).ok())
            .and_then(|pair| u8::from_str_radix(pair, 16).ok());
        match (bytes[index], hex) {
            (b'%', Some(byte)) => {
                out.push(byte);
                index += 3;
            }
            (byte, _) => {
                out.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Whether any scope sets a credential helper (`credential.helper` or `credential.<url>.helper`
/// with a value; an empty value resets the list).
pub fn has_credential_helper(entries: &[ScopedEntry]) -> bool {
    entries.iter().any(|entry| {
        entry.key.starts_with("credential.")
            && entry.key.ends_with(".helper")
            && !entry.value.trim().is_empty()
    })
}

/// Gives the password of `credential` to the credential helpers (`git credential approve`).
pub async fn store_password(
    git: &Git,
    dir: &Path,
    credential: &UrlPassword,
    cancel: &CancellationToken,
) -> Result<(), String> {
    let description = format!(
        "protocol={}\nhost={}\nusername={}\npassword={}\n\n",
        credential.protocol, credential.host, credential.username, credential.password
    );
    let output = git
        .command()
        .current_dir(dir)
        .args(["credential", "approve"])
        .stdin(description)
        .output(cancel)
        .await
        .map_err(|error| error.to_string())?;
    if output.success() {
        Ok(())
    } else {
        Err(output.combined())
    }
}

/// `url` without a password written into it (the user name stays).
pub fn without_password(url: &str) -> String {
    split_password(url).map_or_else(|| url.to_owned(), |split| split.url)
}

/// Tells the credential helpers to forget what they keep for `url` (`git credential reject`,
/// the URL on stdin: git splits it and applies `useHttpPath` itself). A password in `url` is
/// dropped first, so whatever password is kept for the user and server goes.
pub async fn forget_credentials(
    git: &Git,
    dir: &Path,
    url: &str,
    cancel: &CancellationToken,
) -> Result<(), String> {
    let output = git
        .command()
        .current_dir(dir)
        .args(["credential", "reject"])
        .stdin(format!("url={}\n\n", without_password(url)))
        .output(cancel)
        .await
        .map_err(|error| error.to_string())?;
    if output.success() {
        Ok(())
    } else {
        Err(output.combined())
    }
}

#[cfg(test)]
mod tests {
    use super::split_password;

    #[test]
    fn splits_a_password_off_a_url() {
        let split = split_password("https://ada:p%40ss@example.com/team/app.git").unwrap();
        assert_eq!(split.url, "https://ada@example.com/team/app.git");
        assert_eq!(
            (split.username.as_str(), split.password.as_str()),
            ("ada", "p@ss")
        );
        assert_eq!(split.host, "example.com");
        assert!(!format!("{split:?}").contains("p@ss"));
        assert!(split_password("https://ada@example.com/a.git").is_none());
        assert!(split_password("git@example.com:a.git").is_none());
    }
}
