//! After a checkout, the submodules follow the commits the repository now records, when
//! Settings → Submodules asks (`update_after_pull_and_checkout`): a submodule update job
//! starts. Pull does the same itself (`git pull --recurse-submodules`).

use std::sync::Arc;

use super::service::{git, work_tree};
use crate::jobs::{JobRegistry, follow_submodules};
use crate::repository::{RepoId, RepoSessions};
use crate::settings::SettingsStore;

/// Starts updating the submodules of repository `id` after a checkout, if Settings asks and it
/// has submodules. Nothing is reported when it cannot start: the checkout itself succeeded.
pub fn after_checkout(
    registry: &Arc<JobRegistry>,
    settings: &SettingsStore,
    sessions: &RepoSessions,
    id: RepoId,
) {
    let wanted = settings
        .load()
        .is_ok_and(|settings| settings.submodules.update_after_pull_and_checkout);
    if !wanted {
        return;
    }
    let (Ok(session), Ok(git)) = (sessions.get(id), git()) else {
        return;
    };
    let Ok(dir) = work_tree(&session.repo) else {
        return;
    };
    let path = dir.display().to_string();
    if follow_submodules(registry, &git, &dir, path).is_none() {
        tracing::debug!("no submodules to update after the checkout");
    }
}
