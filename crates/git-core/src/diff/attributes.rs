//! What `.gitattributes` say about diffing a file: `-diff` (and the built-in `binary` macro)
//! means "do not show a text diff", `diff` means "text, even with NUL bytes". Read from the work
//! tree, as `git diff` does; a bare repository has none.

use gix::bstr::BStr;

use super::DiffError;

/// The `diff` attribute of a path.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum DiffAttribute {
    /// Not mentioned: git's NUL-byte test decides.
    #[default]
    Unspecified,
    /// `-diff` or `binary`: never a text diff.
    Binary,
    /// `diff` (or a diff driver): always a text diff.
    Text,
}

/// The `diff` attribute of `path` (relative to the work tree, `/`-separated).
pub fn diff_attribute(repo: &gix::Repository, path: &BStr) -> Result<DiffAttribute, DiffError> {
    let Some(worktree) = repo.worktree() else {
        return Ok(DiffAttribute::Unspecified);
    };
    let mut stack = match worktree.attributes_only() {
        Ok(stack) => stack,
        // No index yet (`git clone --no-checkout`): no `.gitattributes` is checked out either.
        Err(error) if error.classify().is_not_found() => return Ok(DiffAttribute::Unspecified),
        Err(error) => return Err(DiffError::gix(error)),
    };
    let mut outcome = stack.selected_attribute_matches(["diff"]);
    let platform = stack.at_entry(path, None).map_err(DiffError::gix)?;
    platform.matching_attributes(&mut outcome);
    let state = outcome
        .iter_selected()
        .next()
        .map(|found| found.assignment.state);
    Ok(match state {
        Some(gix::attrs::StateRef::Unset) => DiffAttribute::Binary,
        Some(gix::attrs::StateRef::Set | gix::attrs::StateRef::Value(_)) => DiffAttribute::Text,
        Some(gix::attrs::StateRef::Unspecified) | None => DiffAttribute::Unspecified,
    })
}
