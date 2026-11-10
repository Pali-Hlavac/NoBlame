//! The todo list of an interactive rebase, written by NoBlame instead of an editor: one line per
//! commit (`pick`, `edit`, `squash`, `fixup`, `drop`). A new message (a reworded commit, or the
//! combined message of squashed commits) becomes an `exec` line after the commit's group that
//! amends it from standard input: `printf '%s\n' 'line' ... | git commit --amend -F -`. git runs
//! `exec` lines with `sh`, so every message line is single-quoted for it; no message files are
//! needed and nothing waits for an editor.

use super::OperationError;

/// What to do with one commit.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TodoAction {
    /// Keep it as it is.
    Pick,
    /// Keep its changes with a new message.
    Reword,
    /// Stop after it, to change it (amend) before going on.
    Edit,
    /// Fold it into the commit above it; the message is the combined one.
    Squash,
    /// Fold it into the commit above it and drop its message.
    Fixup,
    /// Leave it out.
    Drop,
}

/// One commit of the todo list, in the order commits are replayed (oldest first).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TodoStep {
    /// What to do with it.
    pub action: TodoAction,
    /// Its full id.
    pub commit: String,
    /// The new message of the commit this one starts (a reword, or a group with squashes).
    pub message: Option<String>,
}

/// `text` quoted for `sh`: inside single quotes, a quote is closed, escaped and reopened.
fn sh_quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', r"'\''"))
}

/// The `exec` line that gives the commit just made `message`.
fn amend_line(message: &str) -> String {
    let lines: Vec<String> = message
        .trim_end()
        .split('\n')
        .map(|line| sh_quote(line.trim_end_matches('\r')))
        .collect();
    format!(
        "exec printf '%s\\n' {} | git commit --amend --quiet --allow-empty -F -",
        lines.join(" ")
    )
}

fn is_full_id(commit: &str) -> bool {
    matches!(commit.len(), 40 | 64) && commit.bytes().all(|byte| byte.is_ascii_hexdigit())
}

/// The todo list for `steps`. Refused when a commit id is not a full id, a message is empty, or
/// the first kept commit is a squash or fixup (it has nothing to fold into).
pub fn todo_script(steps: &[TodoStep]) -> Result<String, OperationError> {
    let mut script = String::new();
    let mut pending: Option<&str> = None;
    let mut started = false;
    let flush = |script: &mut String, pending: &mut Option<&str>| {
        if let Some(message) = pending.take() {
            script.push_str(&amend_line(message));
            script.push('\n');
        }
    };
    for step in steps {
        if !is_full_id(&step.commit) {
            return Err(OperationError::NotApplicable(format!(
                "{:?} is not a full commit id.",
                step.commit
            )));
        }
        let word = match step.action {
            TodoAction::Pick | TodoAction::Reword => "pick",
            TodoAction::Edit => "edit",
            TodoAction::Squash => "squash",
            TodoAction::Fixup => "fixup",
            TodoAction::Drop => "drop",
        };
        match step.action {
            TodoAction::Squash | TodoAction::Fixup if !started => {
                return Err(OperationError::NotApplicable(
                    "The first commit kept cannot be squashed or fixed up: there is no commit \
                     before it to fold it into."
                        .to_owned(),
                ));
            }
            TodoAction::Squash | TodoAction::Fixup | TodoAction::Drop => {}
            TodoAction::Pick | TodoAction::Reword | TodoAction::Edit => {
                flush(&mut script, &mut pending);
                started = true;
                if let Some(message) = &step.message {
                    if message.trim().is_empty() {
                        return Err(OperationError::NotApplicable(
                            "A commit message cannot be empty.".to_owned(),
                        ));
                    }
                    pending = Some(message);
                }
            }
        }
        script.push_str(word);
        script.push(' ');
        script.push_str(&step.commit);
        script.push('\n');
    }
    flush(&mut script, &mut pending);
    if !started {
        return Err(OperationError::NotApplicable(
            "Every commit would be dropped. Use Reset instead.".to_owned(),
        ));
    }
    Ok(script)
}

#[cfg(test)]
mod tests {
    use super::{TodoAction, TodoStep, sh_quote, todo_script};

    fn step(action: TodoAction, commit: char, message: Option<&str>) -> TodoStep {
        TodoStep {
            action,
            commit: commit.to_string().repeat(40),
            message: message.map(str::to_owned),
        }
    }

    #[test]
    fn writes_one_line_per_commit_and_amends_after_a_group() {
        let script = todo_script(&[
            step(
                TodoAction::Reword,
                'a',
                Some("New subject\n\nIt's the body.\n"),
            ),
            step(TodoAction::Squash, 'b', None),
            step(TodoAction::Drop, 'c', None),
            step(TodoAction::Fixup, 'd', None),
            step(TodoAction::Edit, 'e', None),
        ])
        .unwrap();
        let id = |letter: &str| letter.repeat(40);
        assert_eq!(
            script,
            format!(
                "pick {}\nsquash {}\ndrop {}\nfixup {}\n\
                 exec printf '%s\\n' 'New subject' '' 'It'\\''s the body.' | git commit --amend \
                 --quiet --allow-empty -F -\nedit {}\n",
                id("a"),
                id("b"),
                id("c"),
                id("d"),
                id("e")
            )
        );
    }

    #[test]
    fn refuses_what_git_could_not_do() {
        assert!(todo_script(&[step(TodoAction::Fixup, 'a', None)]).is_err());
        assert!(
            todo_script(&[
                step(TodoAction::Drop, 'a', None),
                step(TodoAction::Squash, 'b', None)
            ])
            .is_err()
        );
        assert!(todo_script(&[step(TodoAction::Drop, 'a', None)]).is_err());
        assert!(todo_script(&[step(TodoAction::Reword, 'a', Some("  \n"))]).is_err());
        let short = TodoStep {
            action: TodoAction::Pick,
            commit: "abc".to_owned(),
            message: None,
        };
        assert!(todo_script(&[short]).is_err());
    }

    #[test]
    fn quotes_for_sh() {
        assert_eq!(sh_quote("it's $HOME `x`"), r"'it'\''s $HOME `x`'");
    }
}
