//! What git or ssh asks for when it runs the askpass program (`GIT_ASKPASS`, `SSH_ASKPASS`):
//! the prompt is its only argument, and the answer is read from its standard output. Prompts
//! are English because `GitCommand` sets `LC_ALL=C`.

/// The kind of answer a prompt wants.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PromptKind {
    /// `Username for 'https://example.com': `.
    Username,
    /// `Password for 'https://ada@example.com': `, `ada@host's password: `.
    Password,
    /// `Enter passphrase for key '/home/ada/.ssh/id_ed25519': `.
    Passphrase,
    /// ssh meets an unknown host key: `… Are you sure you want to continue connecting
    /// (yes/no/[fingerprint])?`. The answer is `yes` or `no`.
    HostKey,
    /// Anything else (a PIN, a one-time code). Treated as secret.
    Other,
}

impl PromptKind {
    /// The answer must not be shown while it is typed.
    pub fn is_secret(self) -> bool {
        !matches!(self, Self::Username | Self::HostKey)
    }
}

/// Classifies an askpass prompt.
pub fn classify_prompt(prompt: &str) -> PromptKind {
    let lower = prompt.to_lowercase();
    if lower.contains("continue connecting") || lower.contains("(yes/no") {
        PromptKind::HostKey
    } else if lower.starts_with("username") {
        PromptKind::Username
    } else if lower.contains("passphrase") {
        PromptKind::Passphrase
    } else if lower.contains("password") {
        PromptKind::Password
    } else {
        PromptKind::Other
    }
}

#[cfg(test)]
mod tests {
    use super::{PromptKind, classify_prompt};

    #[test]
    fn tells_what_is_asked() {
        let cases = [
            ("Username for 'https://github.com': ", PromptKind::Username),
            (
                "Password for 'https://ada@github.com': ",
                PromptKind::Password,
            ),
            ("ada@build.example.com's password: ", PromptKind::Password),
            (
                "Enter passphrase for key '/c/Users/ada/.ssh/id_ed25519': ",
                PromptKind::Passphrase,
            ),
            (
                "The authenticity of host 'example.com (1.2.3.4)' can't be established.\n\
                 ED25519 key fingerprint is SHA256:abc.\n\
                 Are you sure you want to continue connecting (yes/no/[fingerprint])? ",
                PromptKind::HostKey,
            ),
            // OpenSSH 10 quotes the path.
            (
                r#"Enter passphrase for "C:\Users\ada\.ssh\id_ed25519": "#,
                PromptKind::Passphrase,
            ),
            ("Enter PIN for authenticator: ", PromptKind::Other),
        ];
        for (prompt, kind) in cases {
            assert_eq!(classify_prompt(prompt), kind, "{prompt}");
        }
        assert!(!PromptKind::Username.is_secret());
        assert!(PromptKind::Other.is_secret());
    }
}
