//! What a failed job says: a plain-language hint first, then git's own reasons.

use git_core::cli::GitOutput;
use git_core::remote::redact_credentials;

use super::registry::Hint;

/// Lines of git's error output a failed job's message keeps.
const FAILURE_LINES: usize = 6;

/// The job's hint when one applies, then git's reasons (from both streams: pull reports
/// conflicts on standard output). The hint goes first: git's lines can be long (a remote's
/// whole path).
pub(super) fn failed(output: &GitOutput, hint: Option<Hint>) -> String {
    let text = redact_credentials(&output.combined());
    let message = failure_message(&text);
    match hint.and_then(|hint| hint(&text)) {
        Some(hint) => format!("{hint}\n{message}"),
        None => message,
    }
}

/// git's explanation of a failure: its `fatal:` and `error:` lines, else its last lines.
pub fn failure_message(stderr: &str) -> String {
    let marked: Vec<&str> = stderr
        .lines()
        .filter_map(|line| {
            line.strip_prefix("fatal: ")
                .or_else(|| line.strip_prefix("error: "))
        })
        .collect();
    let lines: Vec<&str> = if marked.is_empty() {
        let all: Vec<&str> = stderr
            .lines()
            .filter(|line| !line.trim().is_empty())
            .collect();
        all[all.len().saturating_sub(FAILURE_LINES)..].to_vec()
    } else {
        marked.into_iter().take(FAILURE_LINES).collect()
    };
    if lines.is_empty() {
        "git failed without saying why.".to_owned()
    } else {
        lines.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::failure_message;

    #[test]
    fn keeps_gits_reasons() {
        let stderr = "fatal: 'nowhere' does not appear to be a git repository\n\
                      fatal: Could not read from remote repository.\n\n\
                      Please make sure you have the correct access rights\n\
                      and the repository exists.";
        assert_eq!(
            failure_message(stderr),
            "'nowhere' does not appear to be a git repository\nCould not read from remote repository."
        );
        assert_eq!(failure_message("odd\nthing\n"), "odd\nthing");
        assert_eq!(failure_message(""), "git failed without saying why.");
    }
}
