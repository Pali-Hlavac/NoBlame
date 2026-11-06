//! What the credential prompts look like to the UI, and their events.

use git_core::remote::PromptKind;
use serde::{Deserialize, Serialize};
use specta::Type;

/// What a prompt asks for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CredentialKindDto {
    /// A user name.
    Username,
    /// A password (or a token used as one).
    Password,
    /// The passphrase of an SSH key.
    Passphrase,
    /// ssh does not know the server's key yet: answer `yes` or `no`.
    HostKey,
    /// Something else (a PIN, a code); treated as secret.
    Other,
}

impl From<PromptKind> for CredentialKindDto {
    fn from(kind: PromptKind) -> Self {
        match kind {
            PromptKind::Username => Self::Username,
            PromptKind::Password => Self::Password,
            PromptKind::Passphrase => Self::Passphrase,
            PromptKind::HostKey => Self::HostKey,
            PromptKind::Other => Self::Other,
        }
    }
}

/// git or ssh, running for a job, waits for an answer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CredentialRequestDto {
    /// Identifies this prompt for `answer_credential`.
    pub id: u32,
    /// The job whose git asks.
    pub job_id: u32,
    /// That job's title (`Fetch origin`).
    pub job_title: String,
    /// That job's repository.
    pub repo_path: String,
    /// git's or ssh's own words, trimmed (`Password for 'https://ada@example.com':`).
    pub prompt: String,
    /// What it asks for.
    pub kind: CredentialKindDto,
    /// Hide the answer while it is typed.
    pub secret: bool,
}

/// A prompt waits for an answer. The list (`list_credential_requests`) is the source of truth;
/// this says when to read it.
#[derive(Debug, Clone, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct CredentialRequested {
    /// The prompt.
    pub request: CredentialRequestDto,
}

/// A prompt was answered, cancelled, timed out, or its job ended: close its dialog.
#[derive(Debug, Clone, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct CredentialClosed {
    /// The prompt's id.
    pub id: u32,
}
