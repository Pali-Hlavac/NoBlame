//! Hiding secrets in settings before they leave the backend: passwords written into URLs
//! (`https://ada:token@host` → `https://ada:***@host`; the user name stays, it is part of the
//! address) and the value of HTTP headers (`http.extraHeader = Authorization: Bearer …` →
//! `Authorization: ***`). A value sent back unchanged is matched to the one it stands for, so
//! saving keeps the secret.

/// What stands for a hidden part.
pub const HIDDEN: &str = "***";

/// The name of the settings whose value is a header with a secret in it.
const HEADER_NAME: &str = "extraheader";

/// `value` of `key` as it may be shown: without passwords or header secrets.
pub fn redact_value(key: &str, value: &str) -> String {
    let name = key.rsplit_once('.').map_or(key, |(_, name)| name);
    if name.eq_ignore_ascii_case(HEADER_NAME) {
        return match value.split_once(':') {
            Some((header, _)) => format!("{header}: {HIDDEN}"),
            None => HIDDEN.to_owned(),
        };
    }
    hide_passwords(value)
}

/// `key` as it may be shown (a URL in it loses its password).
pub fn redact_key(key: &str) -> String {
    hide_passwords(key)
}

/// Whether `text` holds a hidden part.
pub fn holds_hidden(text: &str) -> bool {
    text.contains(HIDDEN)
}

/// Whether a URL in `text` has a password written into it.
pub fn has_password(text: &str) -> bool {
    hide_passwords(text) != text
}

/// `text` with the password of every `scheme://user:password@` URL replaced by `***`.
fn hide_passwords(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find("://") {
        let (before, after) = rest.split_at(start + "://".len());
        out.push_str(before);
        // The authority ends at the first `/`, whitespace or quote.
        let end = after
            .find(|c: char| c == '/' || c.is_whitespace() || c == '\'' || c == '"')
            .unwrap_or(after.len());
        let authority = &after[..end];
        match authority
            .rfind('@')
            .and_then(|at| authority[..at].find(':').map(|colon| (colon, at)))
        {
            Some((colon, at)) => {
                out.push_str(&authority[..=colon]);
                out.push_str(HIDDEN);
                out.push_str(&authority[at..]);
            }
            None => out.push_str(authority),
        }
        rest = &after[end..];
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::{has_password, redact_key, redact_value};

    #[test]
    fn hides_passwords_and_header_values() {
        assert_eq!(
            redact_value("remote.origin.url", "https://ada:t0k@h/r.git"),
            "https://ada:***@h/r.git"
        );
        assert_eq!(
            redact_value("remote.origin.url", "ssh://git@h/o/r.git"),
            "ssh://git@h/o/r.git"
        );
        assert_eq!(
            redact_value("remote.origin.url", "git@h:o/r.git"),
            "git@h:o/r.git"
        );
        assert_eq!(
            redact_value("http.https://h/.extraHeader", "Authorization: Bearer abc"),
            "Authorization: ***"
        );
        assert_eq!(redact_value("http.extraheader", "abc"), "***");
        assert_eq!(
            redact_key("http.https://a:b@h/.proxy"),
            "http.https://a:***@h/.proxy"
        );
        assert!(has_password("https://a:b@h/x"));
        assert!(!has_password("https://a@h/x"));
    }
}
