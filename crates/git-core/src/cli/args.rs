//! Validation of user-supplied values before they reach a git command line.

use super::GitError;

/// Rejects revisions (commit ids, refnames, `HEAD~2`, ...) that git would misread.
///
/// A leading `-` would turn the value into an option (`--output=...` is a classic injection),
/// an empty value changes the meaning of many commands, and NUL cannot be passed in `argv`.
/// Everything else is left to git, which reports unknown revisions itself.
pub fn validate_revision(revision: &str) -> Result<(), GitError> {
    let reason = if revision.is_empty() {
        Some("a revision must not be empty")
    } else if revision.starts_with('-') {
        Some("a revision must not start with '-'")
    } else if revision.contains('\0') {
        Some("a revision must not contain NUL")
    } else if revision.chars().any(char::is_control) {
        Some("a revision must not contain control characters")
    } else {
        None
    };
    match reason {
        Some(reason) => Err(GitError::InvalidArgument {
            value: revision.to_owned(),
            reason,
        }),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_ordinary_revisions() {
        for revision in [
            "HEAD",
            "main",
            "origin/main",
            "v1.0^{commit}",
            "HEAD~2",
            "a1b2c3d",
        ] {
            assert!(validate_revision(revision).is_ok(), "{revision}");
        }
    }

    #[test]
    fn rejects_values_git_would_misread() {
        for revision in ["", "-x", "--output=/tmp/pwned", "a\0b", "a\nb"] {
            assert!(
                matches!(
                    validate_revision(revision),
                    Err(GitError::InvalidArgument { .. })
                ),
                "{revision:?}"
            );
        }
    }
}
