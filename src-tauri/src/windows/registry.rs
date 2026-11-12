//! Managed state: which task each window shows and which repositories wait to be opened.

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, PoisonError};

use super::WindowContext;

/// Label of the main window.
pub const MAIN_WINDOW_LABEL: &str = "main";
/// Prefix of task window labels (`task-1`, `task-2`, ...); matched by `capabilities/task.json`.
pub const TASK_WINDOW_PREFIX: &str = "task-";

#[derive(Debug, Default)]
struct Inner {
    contexts: HashMap<String, WindowContext>,
    next_task_id: u32,
    pending_repositories: Vec<String>,
}

/// Window bookkeeping shared by commands and the second-instance handler.
#[derive(Debug, Default)]
pub struct WindowRegistry {
    inner: Mutex<Inner>,
}

impl WindowRegistry {
    /// Reserves a label for a new task window and remembers its context.
    pub fn register_task(&self, context: WindowContext) -> String {
        let mut inner = self.lock();
        inner.next_task_id += 1;
        let label = format!("{TASK_WINDOW_PREFIX}{}", inner.next_task_id);
        inner.contexts.insert(label.clone(), context);
        label
    }

    /// The label of the open task window showing `context`, if any (it is reused).
    pub fn find(&self, context: &WindowContext) -> Option<String> {
        self.lock()
            .contexts
            .iter()
            .find(|(_, open)| *open == context)
            .map(|(label, _)| label.clone())
    }

    /// Forgets a window (after it closed or failed to open).
    pub fn forget(&self, label: &str) {
        self.lock().contexts.remove(label);
    }

    /// Context of the window with `label`, if it is known.
    pub fn context(&self, label: &str) -> Option<WindowContext> {
        if label == MAIN_WINDOW_LABEL {
            return Some(WindowContext::Main);
        }
        self.lock().contexts.get(label).cloned()
    }

    /// Queues a repository for the main window to open.
    pub fn request_repository(&self, path: String) {
        self.lock().pending_repositories.push(path);
    }

    /// Returns and clears the queued repositories.
    pub fn take_repository_requests(&self) -> Vec<String> {
        std::mem::take(&mut self.lock().pending_repositories)
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        // The data stays consistent even if a holder panicked: every update is one statement.
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::TaskKind;

    #[test]
    fn task_windows_get_unique_labels_and_contexts() {
        let registry = WindowRegistry::default();
        let context = WindowContext::Task {
            task: TaskKind::Commit,
            path: "/repo".into(),
        };
        let first = registry.register_task(context.clone());
        let second = registry.register_task(context.clone());
        assert_ne!(first, second);
        assert!(first.starts_with(TASK_WINDOW_PREFIX));
        assert_eq!(registry.context(&first), Some(context.clone()));
        assert!(registry.find(&context).is_some());
        registry.forget(&first);
        registry.forget(&second);
        assert_eq!(registry.find(&context), None);
        assert_eq!(registry.context(&first), None);
        assert_eq!(
            registry.context(MAIN_WINDOW_LABEL),
            Some(WindowContext::Main)
        );
    }

    #[test]
    fn repository_requests_are_drained_once() {
        let registry = WindowRegistry::default();
        registry.request_repository("/a".into());
        registry.request_repository("/b".into());
        assert_eq!(registry.take_repository_requests(), ["/a", "/b"]);
        assert!(registry.take_repository_requests().is_empty());
    }
}
