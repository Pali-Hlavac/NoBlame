//! What a failed patch or archive tells the user, with a next step for git's usual refusals.

use git_core::patch::PatchError;

use crate::error::{AppError, ErrorCode};
use crate::git_env::GitEnvError;

/// git's words, and what to do about them.
const HINTS: &[(&str, &str)] = &[
    (
        "Dirty index",
        "Some changes are staged. Commit them or unstage them first: git am needs a clean index.",
    ),
    (
        "rebase-apply",
        "An earlier git am or rebase is still in progress. Continue or abort it in the bar above the commits first.",
    ),
    (
        "does not match index",
        "A file the patch changes has changes that are not staged. Commit, stash or stage them first.",
    ),
    ("No valid patches", "This file is not a patch git can read."),
    (
        "Patch format detection failed",
        "This file is not a patch git can read. Mails need a From: and a Subject: line.",
    ),
    (
        "would be overwritten",
        "Your uncommitted changes are in the way. Commit or stash them first.",
    ),
    (
        "patch does not apply",
        "The files differ too much from what the patch expects. It may be meant for another branch.",
    ),
];

/// A next step for git's refusal `output`, if there is a usual one.
pub fn patch_hint(output: &str) -> Option<&'static str> {
    HINTS
        .iter()
        .find(|(words, _)| output.contains(words))
        .map(|(_, hint)| *hint)
}

/// The error shown for `error`.
pub fn patch_error(error: PatchError) -> AppError {
    match error {
        PatchError::Git(error) => GitEnvError::from(error).into(),
        PatchError::Rejected { output } => {
            let hint = patch_hint(&output);
            let error = AppError::new(ErrorCode::GitFailed, output);
            match hint {
                Some(hint) => error.with_hint(hint),
                None => error,
            }
        }
        PatchError::Io { path, source } => {
            tracing::warn!(path = %path.display(), %source, "a patch file could not be read or written");
            AppError::new(ErrorCode::Io, format!("{}: {source}.", path.display()))
                .with_hint("Choose a file or folder you can read and write.")
        }
        PatchError::Invalid(message) => AppError::new(ErrorCode::InvalidInput, message),
    }
}

#[cfg(test)]
mod tests {
    use super::patch_hint;

    #[test]
    fn hints_name_the_next_step() {
        let dirty = "error: Dirty index: cannot apply patches (dirty: f.txt)";
        assert!(patch_hint(dirty).is_some_and(|hint| hint.contains("staged")));
        assert!(patch_hint("error: f.txt: patch does not apply").is_some());
        assert_eq!(patch_hint("fatal: something new"), None);
    }
}
