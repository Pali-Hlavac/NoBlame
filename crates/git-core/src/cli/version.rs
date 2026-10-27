//! Parsing `git --version` and comparing against the minimum supported version.

use std::fmt;

use super::GitError;

/// Oldest git NoBlame supports (ADR 0007). 2.39 is what Debian 12 and Apple's Xcode
/// Command Line Tools ship, and it already has every feature the app relies on.
pub const MIN_GIT_VERSION: GitVersion = GitVersion::new(2, 39, 0);

/// Prefix of the first line printed by `git --version`.
const VERSION_PREFIX: &str = "git version ";

/// A `major.minor.patch` git version. Vendor suffixes (`.windows.2`, `(Apple Git-146)`)
/// are not part of the comparison.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct GitVersion {
    /// Major version, e.g. `2`.
    pub major: u32,
    /// Minor version, e.g. `47`.
    pub minor: u32,
    /// Patch version, e.g. `1`.
    pub patch: u32,
}

impl GitVersion {
    /// Creates a version from its parts.
    pub const fn new(major: u32, minor: u32, patch: u32) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }

    /// Parses the output of `git --version`, e.g. `git version 2.47.1.windows.2`.
    pub fn parse(output: &str) -> Result<Self, GitError> {
        let unparseable = || GitError::UnparseableVersion(output.trim().to_owned());
        let line = output.lines().next().unwrap_or_default().trim();
        let rest = line.strip_prefix(VERSION_PREFIX).ok_or_else(unparseable)?;
        let token = rest.split_whitespace().next().ok_or_else(unparseable)?;
        let mut parts = token.split('.').map(leading_number);
        let major = parts.next().flatten().ok_or_else(unparseable)?;
        let minor = parts.next().flatten().ok_or_else(unparseable)?;
        // Release candidates look like `2.48.0.rc1`; a missing patch counts as 0.
        let patch = parts.next().flatten().unwrap_or(0);
        Ok(Self::new(major, minor, patch))
    }

    /// True when this version is at least [`MIN_GIT_VERSION`].
    pub fn is_supported(self) -> bool {
        self >= MIN_GIT_VERSION
    }
}

impl fmt::Display for GitVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

/// The number at the start of a version component (`"0-rc1"` → `0`), if any.
fn leading_number(part: &str) -> Option<u32> {
    let end = part
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(part.len());
    part[..end].parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_vendor_builds() {
        let cases = [
            ("git version 2.47.1.windows.2\n", GitVersion::new(2, 47, 1)),
            (
                "git version 2.39.5 (Apple Git-154)",
                GitVersion::new(2, 39, 5),
            ),
            ("git version 2.43.0", GitVersion::new(2, 43, 0)),
            ("git version 2.48.0.rc1", GitVersion::new(2, 48, 0)),
            ("git version 2.50", GitVersion::new(2, 50, 0)),
        ];
        for (output, expected) in cases {
            assert_eq!(GitVersion::parse(output).unwrap(), expected, "{output}");
        }
    }

    #[test]
    fn rejects_unexpected_output() {
        for output in ["", "hello", "git version", "git version x.y"] {
            assert!(GitVersion::parse(output).is_err(), "{output:?}");
        }
    }

    #[test]
    fn compares_against_the_minimum() {
        assert!(GitVersion::new(2, 39, 0).is_supported());
        assert!(GitVersion::new(3, 0, 0).is_supported());
        assert!(!GitVersion::new(2, 38, 9).is_supported());
        assert_eq!(MIN_GIT_VERSION.to_string(), "2.39.0");
    }
}
