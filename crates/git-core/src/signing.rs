//! Commit signatures: whether a commit is signed and with what (read from its `gpgsig` header
//! with gix), and whether the signature verifies (`git log --format=%G?`).
//!
//! Verifying runs the program git is configured with (`gpg`, `ssh-keygen` for SSH signatures,
//! `gpgsm` for X.509), as `git log --show-signature` does, so it uses the user's keyrings and
//! allowed signers. It takes tens of milliseconds, so it is done for one commit at a time.

use std::path::Path;

use gix::ObjectId;
use gix::bstr::ByteSlice;
use tokio_util::sync::CancellationToken;

use crate::cli::{Git, GitError};

/// What a commit is signed with, from the first line of its signature.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignatureFormat {
    /// A PGP signature (`gpg`).
    OpenPgp,
    /// An SSH signature (`ssh-keygen -Y`).
    Ssh,
    /// An X.509 (S/MIME) signature (`gpgsm`).
    X509,
    /// A signature git may not know how to check.
    Unknown,
}

/// The verdict of `%G?`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verdict {
    /// Good signature from a trusted key (`G`).
    Good,
    /// Good signature, but the key's validity is unknown (`U`): not trusted in gpg, or not in the
    /// SSH allowed signers.
    UnknownValidity,
    /// Good signature that has expired (`X`).
    Expired,
    /// Good signature made by a key that has expired since (`Y`).
    ExpiredKey,
    /// Good signature made by a key that has been revoked (`R`).
    RevokedKey,
    /// The signature does not match the commit (`B`).
    Bad,
    /// The signature could not be checked (`E`, usually a missing public key), or git did not see
    /// it (`N` for a signed commit: SSH signatures without `gpg.ssh.allowedSignersFile`).
    CannotCheck,
}

/// The result of checking one commit's signature.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignatureCheck {
    /// What the commit is signed with.
    pub format: SignatureFormat,
    /// The verdict.
    pub verdict: Verdict,
    /// Who signed it (`%GS`), when known.
    pub signer: Option<String>,
    /// The signing key (`%GK`).
    pub key: Option<String>,
    /// The key's fingerprint (`%GF`).
    pub fingerprint: Option<String>,
    /// The fingerprint of the primary key when a subkey signed (`%GP`).
    pub primary_fingerprint: Option<String>,
    /// gpg's trust level of the key (`%GT`: `ultimate`, `fully`, `marginal`, ...).
    pub trust: Option<String>,
    /// What the verifying program said (`%GG`), or git's error when it did not run it.
    pub message: String,
}

/// Failures while checking a signature.
#[derive(Debug, thiserror::Error)]
pub enum SigningError {
    /// gix could not read the commit.
    #[error("{0}")]
    Gix(String),
    /// `git log` failed or was cancelled.
    #[error(transparent)]
    Git(#[from] GitError),
}

/// What `commit` is signed with, or `None` when it is not signed. Reads only the commit object.
pub fn signature_format(commit: &gix::Commit<'_>) -> Result<Option<SignatureFormat>, SigningError> {
    let decoded = commit
        .decode()
        .map_err(|error| SigningError::Gix(error.to_string()))?;
    Ok(decoded.extra_headers().pgp_signature().map(format_of))
}

fn format_of(signature: &gix::bstr::BStr) -> SignatureFormat {
    let first_line = signature.lines().next().unwrap_or_default().trim();
    match first_line {
        b"-----BEGIN PGP SIGNATURE-----" => SignatureFormat::OpenPgp,
        b"-----BEGIN SSH SIGNATURE-----" => SignatureFormat::Ssh,
        b"-----BEGIN SIGNED MESSAGE-----" => SignatureFormat::X509,
        _ => SignatureFormat::Unknown,
    }
}

/// `%G?` and the details, separated by NUL; `%GG` last because it spans lines.
const VERIFY_FORMAT: &str = "--format=%G?%x00%GS%x00%GK%x00%GF%x00%GP%x00%GT%x00%GG";

/// Checks the signature of commit `id`; `None` when it is not signed (git does not run then).
/// `dir` is where git runs (the work tree, or the git dir of a bare repository).
pub async fn verify_commit(
    git: &Git,
    dir: &Path,
    repo: &gix::ThreadSafeRepository,
    id: ObjectId,
    cancel: &CancellationToken,
) -> Result<Option<SignatureCheck>, SigningError> {
    let safe = repo.clone();
    let format = tokio::task::spawn_blocking(move || {
        let repo = safe.to_thread_local();
        let commit = repo
            .find_commit(id)
            .map_err(|error| SigningError::Gix(error.to_string()))?;
        signature_format(&commit)
    })
    .await
    .map_err(|error| SigningError::Gix(error.to_string()))??;
    let Some(format) = format else {
        return Ok(None);
    };
    let output = git
        .command()
        .current_dir(dir)
        .read_only()
        .no_lazy_fetch()
        // `log.showSignature` would print the verification before the formatted line.
        .args(["log", "-1", "--no-show-signature", VERIFY_FORMAT])
        .revision(&id.to_string())?
        .paths(std::iter::empty::<&Path>())
        .run(cancel)
        .await?;
    Ok(Some(parse_check(
        format,
        &output.stdout,
        &output.stderr_lossy(),
    )))
}

/// Reads the `VERIFY_FORMAT` line. `stderr` explains a signature git did not check.
fn parse_check(format: SignatureFormat, stdout: &[u8], stderr: &str) -> SignatureCheck {
    let mut fields = stdout.trim_end().split(|&byte| byte == 0);
    let mut next = || {
        let text = String::from_utf8_lossy(fields.next().unwrap_or_default());
        let text = text.trim();
        (!text.is_empty() && text != "undefined").then(|| text.to_owned())
    };
    let verdict = match next().as_deref() {
        Some("G") => Verdict::Good,
        Some("U") => Verdict::UnknownValidity,
        Some("X") => Verdict::Expired,
        Some("Y") => Verdict::ExpiredKey,
        Some("R") => Verdict::RevokedKey,
        Some("B") => Verdict::Bad,
        _ => Verdict::CannotCheck,
    };
    let (signer, key, fingerprint, primary_fingerprint, trust) =
        (next(), next(), next(), next(), next());
    let message = next().unwrap_or_else(|| stderr.trim().to_owned());
    SignatureCheck {
        format,
        verdict,
        signer,
        key,
        fingerprint,
        primary_fingerprint,
        trust,
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_good_ssh_signature() {
        let stdout =
            b"G\0ada@example.com\0SHA256:abc\0SHA256:abc\0\0undefined\0Good \"git\" signature\n\n";
        let check = parse_check(SignatureFormat::Ssh, stdout, "");
        assert_eq!(check.verdict, Verdict::Good);
        assert_eq!(check.signer.as_deref(), Some("ada@example.com"));
        assert_eq!(check.fingerprint.as_deref(), Some("SHA256:abc"));
        assert_eq!(check.primary_fingerprint, None);
        assert_eq!(check.trust, None);
        assert_eq!(check.message, "Good \"git\" signature");
    }

    #[test]
    fn a_signature_git_did_not_see_cannot_be_checked() {
        let stderr = "error: gpg.ssh.allowedSignersFile needs to be configured";
        let check = parse_check(SignatureFormat::Ssh, b"N\0\0\0\0\0undefined\0\n", stderr);
        assert_eq!(check.verdict, Verdict::CannotCheck);
        assert_eq!(check.message, stderr);
    }

    #[test]
    fn recognises_signature_formats() {
        let ssh = b"-----BEGIN SSH SIGNATURE-----\n U1NI\n-----END SSH SIGNATURE-----";
        assert_eq!(format_of(ssh.as_bstr()), SignatureFormat::Ssh);
        assert_eq!(
            format_of(b"-----BEGIN PGP SIGNATURE-----\n\n iHUE".as_bstr()),
            SignatureFormat::OpenPgp
        );
        assert_eq!(
            format_of(b"-----BEGIN SIGNED MESSAGE-----".as_bstr()),
            SignatureFormat::X509
        );
        assert_eq!(format_of(b"something".as_bstr()), SignatureFormat::Unknown);
    }
}
