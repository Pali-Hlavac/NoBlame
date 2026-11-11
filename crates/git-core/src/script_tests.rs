use super::{ScriptError, ScriptValues, expand_script, split_command};

fn values() -> ScriptValues {
    ScriptValues {
        sha: "0123456789abcdef0123456789abcdef01234567".into(),
        subject: "Fix the parser".into(),
        branch: Some("main".into()),
        repo: "C:\\code\\app".into(),
    }
}

#[test]
fn splits_on_spaces_and_groups_quoted_words() {
    assert_eq!(
        split_command(r#"git log --format="%h %s" -n 'two words'"#).unwrap(),
        ["log", "--format=%h %s", "-n", "two words"]
    );
    assert_eq!(split_command("  status  ").unwrap(), ["status"]);
    assert_eq!(split_command("git"), Err(ScriptError::Empty));
    assert_eq!(split_command("log \"open"), Err(ScriptError::OpenQuote));
    assert_eq!(split_command("tag x ''").unwrap(), ["tag", "x", ""]);
}

#[test]
fn fills_placeholders_inside_arguments() {
    let args = expand_script("tag -m {subject} done-{short} {sha}", &values()).unwrap();
    assert_eq!(
        args,
        [
            "tag",
            "-m",
            "Fix the parser",
            "done-01234567",
            "0123456789abcdef0123456789abcdef01234567"
        ]
    );
    assert_eq!(
        expand_script("log {branch}@{1} --format={sha}", &values()).unwrap(),
        [
            "log",
            "main@{1}",
            "--format=0123456789abcdef0123456789abcdef01234567"
        ]
    );
}

#[test]
fn refuses_what_would_go_wrong() {
    let detached = ScriptValues {
        branch: None,
        ..values()
    };
    assert_eq!(
        expand_script("log {branch}", &detached),
        Err(ScriptError::NoBranch)
    );
    assert_eq!(
        expand_script("log {commit}", &values()),
        Err(ScriptError::UnknownPlaceholder("{commit}".into()))
    );
    let dashed = ScriptValues {
        subject: "--output=x".into(),
        ..values()
    };
    assert_eq!(
        expand_script("log {subject}", &dashed),
        Err(ScriptError::OptionLike("{subject}".into()))
    );
    // Inside a longer argument it cannot be an option.
    assert_eq!(
        expand_script("tag -m=x{subject}", &dashed).unwrap(),
        ["tag", "-m=x--output=x"]
    );
}
