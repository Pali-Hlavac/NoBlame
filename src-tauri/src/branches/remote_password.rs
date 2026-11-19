//! Moving the passwords written into a remote's URLs to git's credential helper: each password
//! goes to `git credential approve`, then the URLs are saved without it (all or nothing, through
//! the editor's plan). Refused when no helper is set up: git would forget the password.

use git_core::config::{KeyChange, Scope, apply_plan, canonical_key, plan_changes, redact_value};
use git_core::remote::{has_credential_helper, split_password, store_password};
use tokio_util::sync::CancellationToken;

use super::remote_settings::{entries, plan_error, setup};
use crate::error::{AppError, ErrorCode};
use crate::repository::{RepoId, RepoSessions};

/// Moves the passwords in `remote`'s URL and push URLs to the credential helper; how many moved.
pub async fn move_passwords(
    sessions: &RepoSessions,
    id: RepoId,
    remote: String,
) -> Result<u32, AppError> {
    let session = sessions.get(id)?;
    let (git, dir) = setup(sessions, id)?;
    let _writing = session.lock_writes().await;
    let current = entries(&git, &dir).await?;
    if !has_credential_helper(&current) {
        return Err(AppError::new(
            ErrorCode::InvalidInput,
            "No credential helper is set up, so git would forget the password.",
        )
        .with_hint("Install Git Credential Manager, or set credential.helper, then try again."));
    }
    let cancel = CancellationToken::new();
    let mut changes = Vec::new();
    let mut moved = 0;
    for name in ["url", "pushurl"] {
        let key = format!("remote.{remote}.{name}");
        let wanted = canonical_key(&key);
        let values: Vec<&str> = current
            .iter()
            .filter(|entry| entry.scope == Scope::Local && entry.key == wanted)
            .map(|entry| entry.value.as_str())
            .collect();
        let mut after = Vec::with_capacity(values.len());
        for value in &values {
            match split_password(value) {
                Some(split) => {
                    store_password(&git, &dir, &split, &cancel)
                        .await
                        .map_err(|said| AppError::new(ErrorCode::GitFailed, said))?;
                    after.push(split.url);
                    moved += 1;
                }
                None => after.push((*value).to_owned()),
            }
        }
        if after.iter().zip(&values).any(|(a, b)| a != b) {
            changes.push(KeyChange {
                before: values
                    .iter()
                    .map(|value| redact_value(&key, value))
                    .collect(),
                key,
                after,
            });
        }
    }
    let plan = plan_changes(&current, &changes).map_err(plan_error)?;
    apply_plan(&git, &dir, &plan, &cancel)
        .await
        .map_err(plan_error)?;
    Ok(moved)
}
