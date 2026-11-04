//! What the commit message box offers besides typing: the user's recent messages, the
//! `commit.template`, the comment character, and who the commit is by (gix reads all of it).

use std::path::{Path, PathBuf};

use gix::bstr::{BString, ByteSlice};
use gix::revision::walk::Sorting;
use gix::traverse::commit::simple::CommitTimeOrder;

use super::CommitError;

/// How many commits back from `HEAD` the recent messages are looked for. Bounds the walk on a
/// history where the user has not committed lately.
pub const RECENT_SCAN_LIMIT: usize = 2_000;

/// A template larger than this is not read (a template is a few lines).
pub const TEMPLATE_MAX_BYTES: u64 = 64 * 1024;

/// A name and an e-mail address, as git writes them in a commit.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Identity {
    /// The name.
    pub name: BString,
    /// The e-mail address, without the angle brackets.
    pub email: BString,
}

impl Identity {
    /// Reads `Name <email>` as typed for an author override. `None` when either part is empty or
    /// would not survive git's own parsing (angle brackets inside, a line break).
    pub fn parse(text: &str) -> Option<Self> {
        let (name, rest) = text.trim().split_once('<')?;
        let email = rest.strip_suffix('>')?.trim();
        let name = name.trim();
        let forbidden = |part: &str| part.contains(['<', '>', '\n', '\r']);
        if name.is_empty() || email.is_empty() || forbidden(name) || forbidden(email) {
            return None;
        }
        Some(Self {
            name: name.into(),
            email: email.into(),
        })
    }
}

impl std::fmt::Display for Identity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} <{}>", self.name, self.email)
    }
}

/// The configured `commit.template`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Template {
    /// Where it is, as configured (`~` expanded, relative to the working tree).
    pub path: PathBuf,
    /// Its text, or why it could not be read.
    pub text: Result<BString, String>,
}

/// Who the commit will be by: `author.*`, `user.*` or `GIT_AUTHOR_*`, as git resolves it;
/// `None` when no name or address is configured (git would refuse to commit).
pub fn author_identity(repo: &gix::Repository) -> Option<Identity> {
    let signature = repo.author()?.ok()?;
    if signature.name.trim().is_empty() || signature.email.trim().is_empty() {
        return None;
    }
    Some(Identity {
        name: signature.name.to_owned(),
        email: signature.email.to_owned(),
    })
}

/// The character starting comment lines (`core.commentChar`, `#` by default and for `auto`).
pub fn comment_char(repo: &gix::Repository) -> char {
    let config = repo.config_snapshot();
    config
        .string("core.commentChar")
        .and_then(|value| {
            let value = value.to_str().ok()?.to_owned();
            let mut chars = value.chars();
            let first = chars.next()?;
            (chars.next().is_none()).then_some(first)
        })
        .unwrap_or('#')
}

/// Up to `limit` distinct messages of the newest commits reachable from `HEAD` whose author's
/// address is `email` (any author when `None`), newest first. Looks at most
/// [`RECENT_SCAN_LIMIT`] commits back; empty on a branch without commits.
pub fn recent_messages(
    repo: &gix::Repository,
    email: Option<&[u8]>,
    limit: usize,
) -> Result<Vec<BString>, CommitError> {
    let head = repo.head().map_err(CommitError::gix)?;
    let Some(tip) = head.id() else {
        return Ok(Vec::new());
    };
    let walk = repo
        .rev_walk([tip.detach()])
        .sorting(Sorting::ByCommitTime(CommitTimeOrder::NewestFirst))
        .all()
        .map_err(CommitError::gix)?;
    let mut messages: Vec<BString> = Vec::new();
    for info in walk.take(RECENT_SCAN_LIMIT) {
        let commit = info
            .map_err(CommitError::gix)?
            .object()
            .map_err(CommitError::gix)?;
        if let Some(email) = email {
            let author = commit.author().map_err(CommitError::gix)?;
            if !author.email.trim().eq_ignore_ascii_case(email) {
                continue;
            }
        }
        let message = commit.message_raw().map_err(CommitError::gix)?.trim_end();
        if !message.is_empty() && !messages.iter().any(|known| known == message) {
            messages.push(message.into());
            if messages.len() == limit {
                break;
            }
        }
    }
    Ok(messages)
}

/// The `commit.template` of `repo` (`None` when not configured, or configured in a file the
/// repository's ownership does not let us trust). A relative path is taken from `work_dir`, where
/// git commit runs.
pub fn commit_template(repo: &gix::Repository, work_dir: &Path) -> Option<Template> {
    let configured = match repo.config_snapshot().trusted_path("commit.template") {
        Ok(path) => path?,
        Err(error) => {
            return Some(Template {
                path: PathBuf::new(),
                text: Err(error.to_string()),
            });
        }
    };
    let path = work_dir.join(configured);
    let text = read_template(&path);
    Some(Template { path, text })
}

fn read_template(path: &Path) -> Result<BString, String> {
    let size = std::fs::metadata(path)
        .map_err(|error| error.to_string())?
        .len();
    if size > TEMPLATE_MAX_BYTES {
        return Err(format!(
            "it is larger than {} KB",
            TEMPLATE_MAX_BYTES / 1024
        ));
    }
    std::fs::read(path)
        .map(BString::from)
        .map_err(|error| error.to_string())
}
