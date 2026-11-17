//! Task window preferences (`noblame commit <path>` and the others): whether a window closes
//! by itself once its action succeeded, as dialogs of other Git clients do.

use serde::{Deserialize, Serialize};
use specta::Type;

/// How task windows behave.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct TaskWindowSettings {
    /// A Commit, Pull, Push, Fetch, Switch, Merge, Rebase or Stash window closes once its
    /// action succeeded. Off by default: the window stays, showing the result.
    pub close_after_success: bool,
}
