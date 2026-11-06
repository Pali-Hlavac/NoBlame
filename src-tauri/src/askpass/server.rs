//! The app's side of askpass: a localhost listener that receives prompts from the helper,
//! shows them to the user (events), and sends back the answer. Answers are passed through and
//! never stored or logged; git hands them to the user's credential helper on success.

use std::collections::HashMap;
use std::ffi::OsString;
use std::net::{SocketAddr, TcpListener as StdListener};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use git_core::remote::classify_prompt;
use tauri::{AppHandle, Manager, UserAttentionType};
use tauri_specta::Event;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

use super::protocol::{AskReply, AskRequest, ENV_ADDR, ENV_JOB, ENV_TOKEN, MAX_LINE};
use super::token::{new_token, same_secret};
use super::types::{CredentialClosed, CredentialRequestDto, CredentialRequested};

/// A prompt nobody answers is given up after this long (git then fails).
const PROMPT_TIMEOUT: Duration = Duration::from_secs(10 * 60);

struct JobContext {
    title: String,
    repo_path: String,
}

struct Pending {
    request: CredentialRequestDto,
    reply: oneshot::Sender<Option<String>>,
}

#[derive(Default)]
struct Inner {
    next_id: u32,
    jobs: HashMap<u32, JobContext>,
    pending: Vec<Pending>,
}

/// Where the helper connects, the program git runs as helper, and the secret it presents.
struct Endpoint {
    addr: SocketAddr,
    exe: PathBuf,
    token: String,
}

/// The askpass service of this app run. Managed as `Arc<Askpass>`.
pub struct Askpass {
    app: AppHandle,
    /// `None` when the listener, the executable path or randomness is unavailable: prompts
    /// then fail as they did without askpass.
    endpoint: Option<Endpoint>,
    inner: Mutex<Inner>,
}

impl Askpass {
    /// Binds the listener on a free localhost port and starts accepting helpers.
    pub fn start(app: AppHandle) -> Arc<Self> {
        let bound = bind();
        if let Err(error) = &bound {
            tracing::warn!(%error, "askpass unavailable; remotes needing a password will fail");
        }
        let (listener, endpoint) = match bound {
            Ok((listener, endpoint)) => (Some(listener), Some(endpoint)),
            Err(_) => (None, None),
        };
        let askpass = Arc::new(Self {
            app,
            endpoint,
            inner: Mutex::new(Inner::default()),
        });
        if let Some(listener) = listener {
            let service = Arc::clone(&askpass);
            tauri::async_runtime::spawn(async move {
                if let Err(error) = service.accept(listener).await {
                    tracing::warn!(%error, "askpass listener stopped");
                }
            });
        }
        askpass
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// The environment that makes git and ssh ask this app for `job`; empty when askpass is
    /// unavailable.
    pub fn env_for(&self, job: u32) -> Vec<(&'static str, OsString)> {
        let Some(endpoint) = &self.endpoint else {
            return Vec::new();
        };
        vec![
            ("GIT_ASKPASS", endpoint.exe.clone().into_os_string()),
            ("SSH_ASKPASS", endpoint.exe.clone().into_os_string()),
            // OpenSSH 8.4+: use the askpass program even without DISPLAY or with a terminal.
            ("SSH_ASKPASS_REQUIRE", "force".into()),
            (ENV_ADDR, endpoint.addr.to_string().into()),
            (ENV_TOKEN, endpoint.token.clone().into()),
            (ENV_JOB, job.to_string().into()),
        ]
    }

    /// Lets `job`'s git ask; its prompts are shown with `title` and `repo_path`.
    pub fn register(&self, job: u32, title: &str, repo_path: &str) {
        self.lock().jobs.insert(
            job,
            JobContext {
                title: title.to_owned(),
                repo_path: repo_path.to_owned(),
            },
        );
    }

    /// `job` ended: its prompts still open are closed without an answer.
    pub fn unregister(&self, job: u32) {
        let closed: Vec<Pending> = {
            let mut inner = self.lock();
            inner.jobs.remove(&job);
            let (closed, kept) = std::mem::take(&mut inner.pending)
                .into_iter()
                .partition(|pending| pending.request.job_id == job);
            inner.pending = kept;
            closed
        };
        for pending in closed {
            let id = pending.request.id;
            let _ = pending.reply.send(None);
            self.closed(id);
        }
    }

    /// Prompts waiting for an answer, oldest first.
    pub fn pending(&self) -> Vec<CredentialRequestDto> {
        self.lock()
            .pending
            .iter()
            .map(|pending| pending.request.clone())
            .collect()
    }

    /// Answers prompt `id` (`None` cancels it); false when it is no longer waiting.
    pub fn answer(&self, id: u32, answer: Option<String>) -> bool {
        let pending = {
            let mut inner = self.lock();
            let Some(index) = inner.pending.iter().position(|p| p.request.id == id) else {
                return false;
            };
            inner.pending.remove(index)
        };
        let delivered = pending.reply.send(answer).is_ok();
        self.closed(id);
        delivered
    }

    fn closed(&self, id: u32) {
        if let Err(error) = (CredentialClosed { id }).emit(&self.app) {
            tracing::warn!(%error, "could not send a credential update");
        }
    }

    async fn accept(self: Arc<Self>, listener: StdListener) -> std::io::Result<()> {
        let listener = TcpListener::from_std(listener)?;
        loop {
            let (stream, _) = listener.accept().await?;
            let service = Arc::clone(&self);
            tauri::async_runtime::spawn(async move {
                if let Err(error) = service.serve(stream).await {
                    tracing::warn!(%error, "askpass request failed");
                }
            });
        }
    }

    /// One helper: read its prompt, wait for the user, reply.
    async fn serve(&self, stream: TcpStream) -> std::io::Result<()> {
        let (read, mut write) = stream.into_split();
        let mut line = String::new();
        BufReader::new(read.take(MAX_LINE))
            .read_line(&mut line)
            .await?;
        let answer = match serde_json::from_str::<AskRequest>(&line) {
            Ok(request) if self.accepts(&request.token) => self.ask(request).await,
            Ok(_) => {
                tracing::warn!("askpass request with a wrong token refused");
                None
            }
            Err(error) => {
                tracing::warn!(%error, "askpass request not understood");
                None
            }
        };
        let mut reply = serde_json::to_vec(&AskReply { answer })?;
        reply.push(b'\n');
        write.write_all(&reply).await?;
        write.shutdown().await
    }

    fn accepts(&self, token: &str) -> bool {
        self.endpoint
            .as_ref()
            .is_some_and(|endpoint| same_secret(token, &endpoint.token))
    }

    async fn ask(&self, request: AskRequest) -> Option<String> {
        let (sender, receiver) = oneshot::channel();
        let dto = {
            let mut inner = self.lock();
            let context = inner.jobs.get(&request.job)?;
            let kind = classify_prompt(&request.prompt);
            let dto = CredentialRequestDto {
                id: inner.next_id + 1,
                job_id: request.job,
                job_title: context.title.clone(),
                repo_path: context.repo_path.clone(),
                prompt: request.prompt.trim().to_owned(),
                kind: kind.into(),
                secret: kind.is_secret(),
            };
            inner.next_id += 1;
            inner.pending.push(Pending {
                request: dto.clone(),
                reply: sender,
            });
            dto
        };
        let id = dto.id;
        tracing::info!(id, job = dto.job_id, kind = ?dto.kind, "git asks for a credential");
        if let Err(error) = (CredentialRequested { request: dto }).emit(&self.app) {
            tracing::warn!(%error, "could not show a credential prompt");
        }
        if let Some(window) = self.app.get_webview_window("main") {
            // Flashes the taskbar button when the app is in the background.
            let _ = window.request_user_attention(Some(UserAttentionType::Informational));
        }
        if let Ok(answer) = tokio::time::timeout(PROMPT_TIMEOUT, receiver).await {
            answer.ok().flatten()
        } else {
            tracing::info!(id, "credential prompt timed out");
            self.answer(id, None);
            None
        }
    }
}

fn bind() -> std::io::Result<(StdListener, Endpoint)> {
    let token = new_token().ok_or_else(|| std::io::Error::other("no randomness for a token"))?;
    let listener = StdListener::bind(("127.0.0.1", 0))?;
    listener.set_nonblocking(true)?;
    let endpoint = Endpoint {
        addr: listener.local_addr()?,
        exe: std::env::current_exe()?,
        token,
    };
    Ok((listener, endpoint))
}
