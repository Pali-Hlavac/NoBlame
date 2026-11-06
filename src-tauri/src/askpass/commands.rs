//! Tauri boundary for credential prompts.

use std::sync::Arc;

use tauri::State;

use super::server::Askpass;
use super::types::CredentialRequestDto;

/// Prompts waiting for an answer, oldest first (read on start and on `CredentialRequested`).
#[tauri::command]
#[specta::specta]
pub fn list_credential_requests(askpass: State<'_, Arc<Askpass>>) -> Vec<CredentialRequestDto> {
    askpass.pending()
}

/// Answers a prompt; `null` cancels it (git then fails). False when it no longer waits.
#[tauri::command]
#[specta::specta]
pub fn answer_credential(
    askpass: State<'_, Arc<Askpass>>,
    id: u32,
    answer: Option<String>,
) -> bool {
    askpass.answer(id, answer)
}
