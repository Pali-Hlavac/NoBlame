//! Talking to a remote without fetching: testing the connection (`git ls-remote --heads`) and
//! asking the server for its default branch (`git remote set-head --auto`). Both run as jobs
//! (they may ask for credentials); failures get a next step in plain words.

use std::path::Path;

use crate::cli::{Git, GitCommand};

/// `git ls-remote --heads -- <remote>`: lists the server's branches, changes nothing.
pub fn ls_remote_command(git: &Git, dir: &Path, remote: &str) -> GitCommand {
    git.command()
        .current_dir(dir)
        .read_only()
        .args(["ls-remote", "--heads"])
        .operands([remote])
}

/// `git remote set-head --auto -- <remote>`: sets the remote's default branch here to the
/// server's.
pub fn set_head_auto_command(git: &Git, dir: &Path, remote: &str) -> GitCommand {
    git.command()
        .current_dir(dir)
        .args(["remote", "set-head", "--auto"])
        .operands([remote])
}

/// `Connected: 12 branches on the server` from `ls-remote --heads` output.
pub fn describe_connection(stdout: &str) -> String {
    let branches = stdout
        .lines()
        .filter(|line| line.contains("\trefs/heads/"))
        .count();
    match branches {
        0 => "Connected: the server has no branches yet".to_owned(),
        1 => "Connected: 1 branch on the server".to_owned(),
        n => format!("Connected: {n} branches on the server"),
    }
}

/// What `set-head --auto` said, as a sentence.
pub fn describe_set_head(output: &str) -> String {
    output
        .lines()
        .map(str::trim)
        .rfind(|line| !line.is_empty())
        .map_or_else(|| "Default branch set".to_owned(), str::to_owned)
}

/// A next step for a failed connection, from git's output.
pub fn connection_hint(output: &str) -> Option<&'static str> {
    let lower = output.to_ascii_lowercase();
    let hints: &[(&[&str], &str)] = &[
        (
            &[
                "host key verification failed",
                "remote host identification has changed",
            ],
            "The server's SSH host key is unknown or changed. If you trust the server, check its key fingerprint and accept it, or remove the old one from known_hosts.",
        ),
        (
            &["permission denied (publickey"],
            "The server did not accept your SSH key. Check that it is added to your account and to your SSH agent, or choose a key for this remote.",
        ),
        (
            &[
                "ssl certificate problem",
                "server certificate verification failed",
                "unable to get local issuer certificate",
                "self-signed certificate",
                "self signed certificate",
            ],
            "The server's certificate is not trusted. Behind a company proxy, give git its certificate (CA file), or on Windows use the Windows certificate store (Connection tab).",
        ),
        (
            &["407", "proxy authentication", "via proxy", "proxy connect"],
            "The proxy refused or could not be reached. Check the proxy address and its credentials (Connection tab).",
        ),
        (
            &[
                "authentication failed",
                "could not read username",
                "could not read password",
                "403",
                "401",
                "invalid username or password",
            ],
            "The server did not accept your credentials. Check your user name and password or token, or sign in again.",
        ),
        (
            &[
                "could not resolve host",
                "could not resolve hostname",
                "name or service not known",
            ],
            "The server's name could not be found. Check the URL and your network.",
        ),
        (
            &["timed out", "connection refused", "failed to connect"],
            "The server could not be reached. Check the URL, your network and any proxy.",
        ),
        (
            &[
                "repository not found",
                "does not appear to be a git repository",
                "not found",
            ],
            "There is no repository at this URL, or you may not see it. Check the URL and that your account has access.",
        ),
    ];
    hints
        .iter()
        .find(|(needles, _)| needles.iter().any(|needle| lower.contains(needle)))
        .map(|(_, hint)| *hint)
}

#[cfg(test)]
mod tests {
    use super::{connection_hint, describe_connection, describe_set_head};

    #[test]
    fn counts_the_servers_branches() {
        let out = "abc\trefs/heads/main\ndef\trefs/heads/dev\n";
        assert_eq!(
            describe_connection(out),
            "Connected: 2 branches on the server"
        );
        assert_eq!(
            describe_connection(""),
            "Connected: the server has no branches yet"
        );
        assert_eq!(
            describe_set_head("'origin/HEAD' is unchanged and points to 'main'\n"),
            "'origin/HEAD' is unchanged and points to 'main'"
        );
    }

    #[test]
    fn explains_why_a_connection_failed() {
        let cases = [
            (
                "fatal: Authentication failed for 'https://h/r.git/'",
                "credentials",
            ),
            ("git@h: Permission denied (publickey).", "SSH key"),
            (
                "SSL certificate problem: unable to get local issuer certificate",
                "certificate",
            ),
            ("Received HTTP code 407 from proxy after CONNECT", "proxy"),
            ("Host key verification failed.", "host key"),
            ("fatal: Could not resolve host: nope.example", "name"),
            ("remote: Repository not found.", "no repository"),
        ];
        for (output, word) in cases {
            let hint = connection_hint(output).unwrap_or_default();
            assert!(hint.contains(word), "{output} -> {hint}");
        }
        assert_eq!(connection_hint("something else"), None);
    }
}
