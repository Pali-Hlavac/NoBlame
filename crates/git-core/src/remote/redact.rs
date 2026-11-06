//! Hiding credentials written into remote URLs (`https://ada:token@host/repo`) before git's
//! output is shown or kept in a job log. git hides them in most messages itself; this covers
//! the rest (older gits, hooks, helpers).

/// What replaces the user and password part of a URL.
const HIDDEN: &str = "***";

/// `text` with the `user:password@` part of every `scheme://` URL replaced by `***@`.
pub fn redact_credentials(text: &str) -> String {
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
        match authority.rfind('@') {
            Some(at) => {
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
    use super::redact_credentials;

    #[test]
    fn hides_user_and_password_in_urls() {
        assert_eq!(
            redact_credentials("fatal: unable to access 'https://ada:t0ken@example.com/r.git/'"),
            "fatal: unable to access 'https://***@example.com/r.git/'"
        );
        assert_eq!(
            redact_credentials("From https://ada@example.com/r and ssh://git@host:22/x"),
            "From https://***@example.com/r and ssh://***@host:22/x"
        );
    }

    #[test]
    fn leaves_other_text_alone() {
        for text in [
            "From https://example.com/repo",
            "   1a2b..3c4d  main -> origin/main",
            "git@github.com:ada/repo.git",
            "mail ada@example.com",
            "",
        ] {
            assert_eq!(redact_credentials(text), text);
        }
    }
}
