//! What the askpass helper and the app say to each other: one JSON line each way over a
//! localhost TCP connection. The helper learns where to connect from environment variables
//! the app sets for the git commands of its jobs.

use serde::{Deserialize, Serialize};

/// `host:port` of the app's askpass listener (always `127.0.0.1`).
pub const ENV_ADDR: &str = "NOBLAME_ASKPASS_ADDR";
/// The secret the helper must present; random per app run.
pub const ENV_TOKEN: &str = "NOBLAME_ASKPASS_TOKEN";
/// The job whose git asks.
pub const ENV_JOB: &str = "NOBLAME_ASKPASS_JOB";

/// Longest request or answer line accepted, in bytes.
pub const MAX_LINE: u64 = 64 * 1024;

/// Helper → app.
#[derive(Debug, Serialize, Deserialize)]
pub struct AskRequest {
    pub token: String,
    pub job: u32,
    pub prompt: String,
}

/// App → helper. `None`: the user cancelled (or nobody could answer); the helper exits with 1
/// and git fails with "could not read Username/Password".
#[derive(Debug, Serialize, Deserialize)]
pub struct AskReply {
    pub answer: Option<String>,
}
