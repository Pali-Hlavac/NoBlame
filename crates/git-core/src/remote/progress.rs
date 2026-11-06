//! Reading git's progress lines (`Receiving objects:  45% (1234/2742), 1.20 MiB | 2.40 MiB/s`,
//! `remote: Counting objects: 12, done.`), which fetch, pull, push and clone print with
//! `--progress`. Parsed with `LC_ALL=C`, which `GitCommand` always sets.

/// One step of a remote operation and how far it got.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Progress {
    /// What git is doing (`Receiving objects`, `Resolving deltas`, `Counting objects`).
    pub phase: String,
    /// The server is doing it (the line started with `remote: `).
    pub remote: bool,
    /// Percent done, when git knows the total.
    pub percent: Option<u8>,
    /// Items done so far.
    pub done: Option<u64>,
    /// Items in total, when known.
    pub total: Option<u64>,
    /// What follows the counts (`1.20 MiB | 2.40 MiB/s`, `done.`), trimmed.
    pub detail: String,
}

/// Parses one progress line; `None` for anything else (ref updates, messages).
pub fn parse_progress(line: &str) -> Option<Progress> {
    let (remote, line) = match line.strip_prefix("remote: ") {
        Some(rest) => (true, rest),
        None => (false, line),
    };
    let (phase, rest) = line.split_once(": ")?;
    if phase.is_empty() || !phase.starts_with(|first: char| first.is_ascii_uppercase()) {
        return None;
    }
    let rest = rest.trim_start();
    let progress = if let Some((percent, after)) = rest.split_once('%') {
        let percent = percent.trim().parse::<u8>().ok()?;
        let after = after.trim_start();
        let (counts, detail) = after
            .strip_prefix('(')
            .and_then(|inner| inner.split_once(')'))
            .unwrap_or(("", after));
        let (done, total) = counts.split_once('/').unwrap_or_default();
        Progress {
            phase: phase.to_owned(),
            remote,
            percent: Some(percent.min(100)),
            done: done.parse().ok(),
            total: total.parse().ok(),
            detail: detail.trim_start_matches(',').trim().to_owned(),
        }
    } else {
        let digits = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        let done = rest[..digits].parse().ok()?;
        Progress {
            phase: phase.to_owned(),
            remote,
            percent: None,
            done: Some(done),
            total: None,
            detail: rest[digits..].trim_start_matches(',').trim().to_owned(),
        }
    };
    Some(progress)
}

#[cfg(test)]
mod tests {
    use super::{Progress, parse_progress};

    #[test]
    fn reads_percent_counts_and_detail() {
        assert_eq!(
            parse_progress("Receiving objects:  45% (1234/2742), 1.20 MiB | 2.40 MiB/s"),
            Some(Progress {
                phase: "Receiving objects".into(),
                remote: false,
                percent: Some(45),
                done: Some(1234),
                total: Some(2742),
                detail: "1.20 MiB | 2.40 MiB/s".into(),
            })
        );
        let done = parse_progress("remote: Compressing objects: 100% (5/5), done.").unwrap();
        assert!(done.remote);
        assert_eq!(done.percent, Some(100));
        assert_eq!(done.detail, "done.");
    }

    #[test]
    fn reads_counts_without_a_total() {
        let counting = parse_progress("remote: Enumerating objects: 12, done.").unwrap();
        assert_eq!(counting.phase, "Enumerating objects");
        assert_eq!((counting.percent, counting.done), (None, Some(12)));
    }

    #[test]
    fn ignores_other_lines() {
        for line in [
            "From https://example.com/repo",
            "   1a2b3c4..5d6e7f8  main       -> origin/main",
            "fatal: could not read Username: terminal prompts disabled",
            "remote: Total 3 (delta 0), reused 0 (delta 0)",
            "error: something: 12",
        ] {
            assert_eq!(parse_progress(line), None, "{line}");
        }
    }
}
