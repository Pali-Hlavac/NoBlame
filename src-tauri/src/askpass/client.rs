//! The askpass helper: `noblame` started by git or ssh as `GIT_ASKPASS` / `SSH_ASKPASS`, with
//! the prompt as its only argument. It asks the running app (which shows a dialog) and prints
//! the answer for git to read. Recognised by the environment variables the app sets, before
//! the command line is parsed.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;

use super::protocol::{AskReply, AskRequest, ENV_ADDR, ENV_JOB, ENV_TOKEN, MAX_LINE};

/// Exit code when there is no answer (cancelled, the app is gone): git then fails as if the
/// prompt could not be shown.
const NO_ANSWER: i32 = 1;

/// When this process is the askpass helper, answers the prompt and returns the exit code;
/// `None` when it is a normal launch.
pub fn run_if_helper() -> Option<i32> {
    let addr = std::env::var(ENV_ADDR).ok()?;
    let token = std::env::var(ENV_TOKEN).ok()?;
    let job = std::env::var(ENV_JOB).ok()?.parse().ok()?;
    let prompt = std::env::args_os()
        .nth(1)
        .map(|arg| arg.to_string_lossy().into_owned())
        .unwrap_or_default();
    let request = AskRequest { token, job, prompt };
    Some(match ask(&addr, &request) {
        Ok(Some(answer)) => {
            let mut stdout = std::io::stdout().lock();
            match writeln!(stdout, "{answer}").and_then(|()| stdout.flush()) {
                Ok(()) => 0,
                Err(_) => NO_ANSWER,
            }
        }
        Ok(None) | Err(_) => NO_ANSWER,
    })
}

fn ask(addr: &str, request: &AskRequest) -> std::io::Result<Option<String>> {
    let mut stream = TcpStream::connect(addr)?;
    let mut line = serde_json::to_vec(request)?;
    line.push(b'\n');
    stream.write_all(&line)?;
    let mut reply = String::new();
    BufReader::new(stream.take(MAX_LINE)).read_line(&mut reply)?;
    let reply: AskReply = serde_json::from_str(&reply)?;
    Ok(reply.answer)
}
