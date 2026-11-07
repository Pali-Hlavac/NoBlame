//! Branches and tags: checking out, creating, renaming and deleting them with the `git` CLI
//! (`write.rs`, `tag.rs`), so hooks (`post-checkout`), signing (`tag.gpgSign`) and the user's
//! config apply. Before a rename or a delete the reference is checked with gix: it must still
//! point at the commit the user saw (`check_ref`). Deleting asks first how many commits no other
//! branch or tag holds (`unique.rs`), so the confirmation can name what would be lost.
//! `upstream.rs` lists, counts, sets and unsets the upstreams of local branches.

mod tag;
mod unique;
mod upstream;
mod write;

use gix::ObjectId;
use gix::bstr::BStr;

use crate::cli::{GitError, GitOutput};

pub use tag::{create_tag, delete_tag};
pub use unique::{UniqueCommits, commits_not_in, unique_commits};
pub use upstream::{
    BranchUpstream, Tracking, ahead_behind, set_upstream, unset_upstream, upstreams,
};
pub use write::{
    CreateBranch, create_branch, delete_branch, rename_branch, switch_branch, switch_detached,
};

/// Failures while changing branches and tags.
#[derive(Debug, thiserror::Error)]
pub enum BranchError {
    /// gix could not read the reference.
    #[error("{0}")]
    Gix(String),
    /// git could not run.
    #[error(transparent)]
    Git(#[from] GitError),
    /// git refused (local changes in the way, the name exists, ...); `output` is what it said.
    #[error("{output}")]
    Rejected {
        /// Standard output and standard error, trimmed.
        output: String,
    },
    /// The name cannot be a branch or tag name.
    #[error("“{name}” cannot be used as a name: {reason}")]
    InvalidName {
        /// The name as given.
        name: String,
        /// Why, in words.
        reason: String,
    },
    /// The text cannot be a remote's URL (empty, starts with `-`, control characters).
    #[error("this URL cannot be used: {reason}")]
    InvalidUrl {
        /// Why, in words.
        reason: String,
    },
    /// The reference is gone or points elsewhere since the user saw it; nothing was done.
    #[error("{name} changed since it was shown")]
    Moved {
        /// Its full name (`refs/heads/main`).
        name: String,
    },
    /// git printed something this module could not read.
    #[error("unexpected output from git: {0}")]
    Parse(String),
    /// HEAD is not on a branch (detached), so there is no current branch to push or pull.
    #[error("HEAD is not on a branch")]
    Detached,
    /// The branch has no upstream on a named remote, so a plain push does not know where to go.
    #[error("{branch} has no upstream on a remote")]
    NoRemoteUpstream {
        /// The branch (`feature/x`).
        branch: String,
    },
}

/// What kind of name is checked (the prefix it gets under `refs/`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefNamespace {
    /// `refs/heads/`.
    Branch,
    /// `refs/tags/`.
    Tag,
    /// `refs/remotes/` (the name includes the remote: `origin/main`).
    Remote,
}

impl RefNamespace {
    /// The full reference name of `name` in this namespace.
    pub fn full_name(self, name: &str) -> String {
        let prefix = match self {
            Self::Branch => "refs/heads/",
            Self::Tag => "refs/tags/",
            Self::Remote => "refs/remotes/",
        };
        format!("{prefix}{name}")
    }
}

/// Checks that `name` can be a new branch or tag: git's reference name rules (no spaces, `..`,
/// `~^:?*[\`, `@{`, no `.lock` ending, ...), plus no leading `-` and not `HEAD`.
pub fn validate_name(namespace: RefNamespace, name: &str) -> Result<(), BranchError> {
    let invalid = |reason: &str| BranchError::InvalidName {
        name: name.to_owned(),
        reason: reason.to_owned(),
    };
    if name.starts_with('-') {
        return Err(invalid("it must not start with “-”"));
    }
    if name == "HEAD" || name == "@" {
        return Err(invalid("it is reserved"));
    }
    if name.chars().any(char::is_whitespace) {
        return Err(invalid("it must not contain spaces"));
    }
    let full = namespace.full_name(name);
    gix::validate::reference::name(BStr::new(full.as_bytes()))
        .map(|_| ())
        .map_err(|error| invalid(&lower_first(&error.to_string())))
}

/// Checks that the reference `full_name` still points at `expected` (annotated tags peeled to
/// their commit). Fails with [`BranchError::Moved`] when it is gone or points elsewhere.
pub fn check_ref(
    repo: &gix::Repository,
    full_name: &str,
    expected: ObjectId,
) -> Result<(), BranchError> {
    let moved = || BranchError::Moved {
        name: full_name.to_owned(),
    };
    let Some(mut reference) = repo
        .try_find_reference(full_name)
        .map_err(|error| BranchError::Gix(error.to_string()))?
    else {
        return Err(moved());
    };
    let id = reference
        .peel_to_id()
        .map_err(|error| BranchError::Gix(error.to_string()))?;
    let commit = id
        .object()
        .and_then(gix::Object::peel_to_commit)
        .map_or_else(|_| id.detach(), |commit| commit.id);
    if commit == expected || id.detach() == expected {
        Ok(())
    } else {
        Err(moved())
    }
}

/// The commit HEAD points to; `None` while the branch is unborn (no commit yet).
pub fn head_commit(repo: &gix::Repository) -> Option<ObjectId> {
    repo.head_id().ok().map(gix::Id::detach)
}

/// Everything git printed, when it succeeded; otherwise the same text as the error.
pub(crate) fn accepted(output: &GitOutput) -> Result<String, BranchError> {
    let text = output.combined();
    if output.success() {
        Ok(text)
    } else {
        Err(BranchError::Rejected { output: text })
    }
}

fn lower_first(text: &str) -> String {
    let mut chars = text.chars();
    chars.next().map_or_else(String::new, |first| {
        first.to_lowercase().chain(chars).collect()
    })
}

#[cfg(test)]
mod tests {
    use super::{RefNamespace, validate_name};

    #[test]
    fn accepts_ordinary_names() {
        for name in [
            "main",
            "feature/login",
            "fix-12",
            "v1.0.0",
            "ünïcode",
            "a/b/c",
        ] {
            assert!(validate_name(RefNamespace::Branch, name).is_ok(), "{name}");
        }
    }

    #[test]
    fn rejects_what_git_rejects() {
        for name in [
            "",
            "-x",
            "HEAD",
            "@",
            "a b",
            "a..b",
            "a~1",
            "a^",
            "a:b",
            "a?",
            "a*",
            "a[b",
            "a\\b",
            "x.lock",
            "a/",
            "/a",
            "a//b",
            ".a",
            "a/.b",
            "a.",
            "a@{1}",
            "tab\tname",
        ] {
            assert!(
                validate_name(RefNamespace::Branch, name).is_err(),
                "{name:?}"
            );
        }
    }
}
