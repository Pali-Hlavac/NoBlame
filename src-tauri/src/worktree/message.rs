//! What the commit message box reads before the user types: the configured author, the
//! `commit.template`, the comment character, and the user's recent messages.

use git_core::commit::{author_identity, comment_char, commit_template, recent_messages};

use super::service::work_dir;
use super::types::{CommitDefaultsDto, CommitTemplateDto};
use crate::repository::{RepoId, RepoSessions, RepositoryError, blocking};

/// Recent messages offered in the message box.
const RECENT_MESSAGES: usize = 20;

/// The author, the template and the comment character of the repository's config.
pub async fn defaults(
    sessions: &RepoSessions,
    id: RepoId,
) -> Result<CommitDefaultsDto, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let work_dir = work_dir(&repo).ok_or(RepositoryError::Bare)?;
    blocking(move || {
        let repo = repo.local();
        let template = commit_template(&repo, &work_dir).map(|template| {
            let (text, problem) = match template.text {
                Ok(text) => (Some(String::from_utf8_lossy(&text).into_owned()), None),
                Err(problem) => (None, Some(problem)),
            };
            CommitTemplateDto {
                path: template.path.display().to_string(),
                text,
                problem,
            }
        });
        CommitDefaultsDto {
            author: author_identity(&repo).map(|author| author.to_string()),
            template,
            comment_char: comment_char(&repo).to_string(),
        }
    })
    .await
}

/// The newest distinct messages of the user's own commits reachable from HEAD (everyone's when
/// no address is configured).
pub async fn recent(sessions: &RepoSessions, id: RepoId) -> Result<Vec<String>, RepositoryError> {
    let repo = sessions.get(id)?.repo.clone();
    let messages = blocking(move || {
        let repo = repo.local();
        let email = author_identity(&repo).map(|author| author.email);
        recent_messages(
            &repo,
            email.as_ref().map(|email| email.as_slice()),
            RECENT_MESSAGES,
        )
    })
    .await??;
    Ok(messages
        .iter()
        .map(|message| String::from_utf8_lossy(message).into_owned())
        .collect())
}
