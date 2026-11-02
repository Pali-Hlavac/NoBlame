//! Commit details: checking a commit's signature with the user's gpg, ssh-keygen or gpgsm.

use git_core::cli::Git;
use git_core::diff::parse_object_id;
use git_core::signing::{SignatureCheck, SignatureFormat, Verdict, verify_commit};
use serde::Serialize;
use specta::Type;
use tokio_util::sync::CancellationToken;

use crate::git_env::GitEnvError;
use crate::repository::{RepoId, RepoSessions, RepositoryError};

/// What a commit is signed with.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SignatureFormatDto {
    /// PGP (`gpg`).
    OpenPgp,
    /// SSH (`ssh-keygen`).
    Ssh,
    /// X.509 (`gpgsm`).
    X509,
    /// Not recognised.
    Unknown,
}

impl From<SignatureFormat> for SignatureFormatDto {
    fn from(format: SignatureFormat) -> Self {
        match format {
            SignatureFormat::OpenPgp => Self::OpenPgp,
            SignatureFormat::Ssh => Self::Ssh,
            SignatureFormat::X509 => Self::X509,
            SignatureFormat::Unknown => Self::Unknown,
        }
    }
}

/// Whether the signature verifies (git's `%G?`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SignatureVerdictDto {
    /// Good, from a trusted key.
    Good,
    /// Good, but the key is not trusted or not an allowed signer.
    UnknownValidity,
    /// Good, but the signature has expired.
    Expired,
    /// Good, made by a key that has expired.
    ExpiredKey,
    /// Good, made by a key that has been revoked.
    RevokedKey,
    /// Does not match the commit.
    Bad,
    /// Could not be checked (missing key, no allowed signers, missing program).
    CannotCheck,
}

impl From<Verdict> for SignatureVerdictDto {
    fn from(verdict: Verdict) -> Self {
        match verdict {
            Verdict::Good => Self::Good,
            Verdict::UnknownValidity => Self::UnknownValidity,
            Verdict::Expired => Self::Expired,
            Verdict::ExpiredKey => Self::ExpiredKey,
            Verdict::RevokedKey => Self::RevokedKey,
            Verdict::Bad => Self::Bad,
            Verdict::CannotCheck => Self::CannotCheck,
        }
    }
}

/// The result of checking a commit's signature.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SignatureCheckDto {
    /// What the commit is signed with.
    pub format: SignatureFormatDto,
    /// Whether it verifies.
    pub verdict: SignatureVerdictDto,
    /// Who signed it, when known.
    pub signer: Option<String>,
    /// The signing key.
    pub key: Option<String>,
    /// The key's fingerprint.
    pub fingerprint: Option<String>,
    /// The primary key's fingerprint when a subkey signed.
    pub primary_fingerprint: Option<String>,
    /// gpg's trust level of the key.
    pub trust: Option<String>,
    /// What the verifying program (or git) said.
    pub message: String,
}

impl From<SignatureCheck> for SignatureCheckDto {
    fn from(check: SignatureCheck) -> Self {
        Self {
            format: check.format.into(),
            verdict: check.verdict.into(),
            signer: check.signer,
            key: check.key,
            fingerprint: check.fingerprint,
            primary_fingerprint: check.primary_fingerprint,
            trust: check.trust,
            message: check.message,
        }
    }
}

/// Checks the signature of commit `commit` (hex id); `None` when it is not signed.
pub async fn verify(
    sessions: &RepoSessions,
    id: RepoId,
    commit: String,
) -> Result<Option<SignatureCheckDto>, RepositoryError> {
    let session = sessions.get(id)?;
    let commit = parse_object_id(&commit)?;
    let git = Git::locate().map_err(GitEnvError::from)?;
    let info = session.repo.info();
    let dir = info.work_dir.as_ref().unwrap_or(&info.git_dir);
    let repo = session.repo.thread_safe();
    // One process of a few tens of milliseconds; nothing cancels it.
    let check = verify_commit(&git, dir, &repo, commit, &CancellationToken::new()).await?;
    Ok(check.map(SignatureCheckDto::from))
}
