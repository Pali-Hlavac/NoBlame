//! The repository's remotes, read with gix.

/// Remote names (`origin`, `upstream`), sorted.
pub fn remote_names(repo: &gix::Repository) -> Vec<String> {
    repo.remote_names()
        .into_iter()
        .map(|name| name.to_string())
        .collect()
}
