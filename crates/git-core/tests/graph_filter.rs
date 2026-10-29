//! Filtered graphs checked against `git log`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::collections::BTreeSet;
use std::sync::Arc;

use git_core::cli::Git;
use git_core::graph::{
    Graph, GraphError, GraphFilter, MAX_ROWS_PER_PAGE, RefKind, RefSelector, TextFilter, Tips,
    commit_details, commit_rows, commits_changing,
};
use git_core::repo::Repository;
use noblame_repo_gen::{Preset, generate};
use tokio_util::sync::CancellationToken;

fn git_log(dir: &std::path::Path, args: &[&str]) -> Vec<String> {
    let output = std::process::Command::new("git")
        .args(["log", "--date-order", "--format=%H"])
        .args(args)
        .current_dir(dir)
        .output()
        .unwrap();
    assert!(output.status.success());
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(str::to_owned)
        .collect()
}

fn ids(repo: &gix::Repository, graph: &Graph) -> Vec<String> {
    (0..graph.row_count())
        .step_by(MAX_ROWS_PER_PAGE as usize)
        .flat_map(|start| commit_rows(repo, graph, start, MAX_ROWS_PER_PAGE).unwrap())
        .map(|row| row.id)
        .collect()
}

fn set(ids: &[String]) -> BTreeSet<&str> {
    ids.iter().map(String::as_str).collect()
}

#[test]
fn filters_show_the_commits_git_log_shows() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let repo = Repository::discover(dir.path()).unwrap().local();
    let full = Arc::new(Graph::build(&repo).unwrap());
    let all = ids(&repo, &full);
    let branch = full
        .refs_with_rows()
        .into_iter()
        .find(|(reference, _)| reference.kind == RefKind::LocalBranch && reference.name != "main")
        .map(|(reference, _)| reference.name.clone())
        .unwrap();
    let on_branch = Tips::Refs(vec![RefSelector {
        kind: RefKind::LocalBranch,
        name: branch.clone(),
    }]);

    let cases: [(GraphFilter, Vec<&str>); 5] = [
        (
            GraphFilter {
                no_merges: true,
                ..GraphFilter::default()
            },
            vec!["--all", "--no-merges"],
        ),
        (
            GraphFilter {
                first_parent: true,
                ..GraphFilter::default()
            },
            vec!["--all", "--first-parent"],
        ),
        (
            GraphFilter {
                tips: on_branch.clone(),
                ..GraphFilter::default()
            },
            vec![branch.as_str()],
        ),
        (
            GraphFilter {
                tips: Tips::Head,
                first_parent: true,
                no_merges: true,
                ..GraphFilter::default()
            },
            vec!["HEAD", "--first-parent", "--no-merges"],
        ),
        (
            GraphFilter {
                tips: on_branch,
                first_parent: true,
                ..GraphFilter::default()
            },
            vec![branch.as_str(), "--first-parent"],
        ),
    ];
    for (filter, args) in cases {
        let view = full.filtered(&filter);
        let shown = ids(&repo, &view);
        let expected = git_log(dir.path(), &args);
        assert!(
            !expected.is_empty() && expected.len() < all.len(),
            "{args:?}"
        );
        assert_eq!(set(&shown), set(&expected), "{args:?}");
        // The view keeps the full graph's order.
        let in_full: Vec<&String> = all.iter().filter(|id| shown.contains(id)).collect();
        assert_eq!(in_full, shown.iter().collect::<Vec<_>>(), "{args:?}");
        if args.contains(&"--no-merges") && args.contains(&"--all") {
            assert_eq!(shown, expected, "same order as git");
        }
        // In a view, commit i is on row i: every line goes down to a later row.
        for row in 0..view.row_count() {
            assert!(view.index().parents(row).iter().all(|&parent| parent > row));
        }
        let laid_out: usize = (0..view.block_count()).map(|b| view.block(b).len()).sum();
        assert_eq!(laid_out, shown.len());
        // Details come from the full history.
        let details = commit_details(&repo, &view, 0).unwrap();
        assert_eq!(details.id, shown[0]);
        for parent in &details.parents {
            let row = parent.row.map(|row| shown[row as usize].clone());
            assert!(row.is_none() || row.as_deref() == Some(parent.id.as_str()));
        }
    }
}

#[test]
fn author_and_message_filters_match_git_log() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let opened = Repository::discover(dir.path()).unwrap();
    let repo = opened.local();
    let full = Arc::new(Graph::build(&repo).unwrap());
    let top = &commit_rows(&repo, &full, 0, 1).unwrap()[0];
    // A word of an author, upper-cased to check that case is ignored.
    let author = top
        .author_name
        .split_whitespace()
        .last()
        .unwrap()
        .to_uppercase();
    let message = "M00";
    let text = |author: Option<&str>, message: Option<&str>| GraphFilter {
        text: TextFilter {
            author: author.map(str::to_owned),
            message: message.map(str::to_owned),
        },
        first_parent: true,
        ..GraphFilter::default()
    };
    let author_arg = format!("--author={author}");
    let grep_arg = format!("--grep={message}");
    let cases = [
        (text(Some(&author), None), vec![author_arg.as_str()]),
        (text(None, Some(message)), vec![grep_arg.as_str()]),
        (
            text(Some(&author), Some(message)),
            vec![author_arg.as_str(), grep_arg.as_str()],
        ),
    ];
    for (filter, args) in cases {
        let cancel = CancellationToken::new();
        let view = full
            .filtered_in(&opened.thread_safe(), &filter, None, &cancel)
            .unwrap();
        let mut git_args = vec!["--all", "--first-parent", "-i", "-F"];
        git_args.extend(&args);
        let expected = git_log(dir.path(), &git_args);
        assert!(!expected.is_empty(), "{args:?}");
        assert_eq!(set(&ids(&repo, &view)), set(&expected), "{args:?}");
    }

    let cancel = CancellationToken::new();
    cancel.cancel();
    let cancelled = full.filtered_in(&opened.thread_safe(), &text(Some("a"), None), None, &cancel);
    assert!(matches!(cancelled, Err(GraphError::Cancelled)));
}

#[tokio::test]
async fn path_filter_matches_git_log() {
    let dir = tempfile::tempdir().unwrap();
    generate(&Preset::Tiny.spec(), dir.path()).unwrap();
    let opened = Repository::discover(dir.path()).unwrap();
    let repo = opened.local();
    let full = Arc::new(Graph::build(&repo).unwrap());
    // A folder some commits changed: the one holding the newest commit's first file.
    let names = git_log(dir.path(), &["-1", "--format=", "--name-only"]);
    let folder = names[0].rsplit_once('/').unwrap().0.to_owned();
    let git = Git::locate().unwrap();
    let cancel = CancellationToken::new();

    for (first_parent, extra) in [(false, None), (true, Some("--first-parent"))] {
        let filter = GraphFilter {
            path: Some(folder.clone()),
            first_parent,
            ..GraphFilter::default()
        };
        let tips = full.tip_ids(&filter.tips);
        let changing = commits_changing(&git, dir.path(), &tips, first_parent, &folder, &cancel)
            .await
            .unwrap();
        let view = full
            .filtered_in(&opened.thread_safe(), &filter, Some(&changing), &cancel)
            .unwrap();
        let mut args = vec!["--all"];
        args.extend(extra);
        args.extend(["--", folder.as_str()]);
        let expected = git_log(dir.path(), &args);
        assert!(!expected.is_empty() && expected.len() < full.row_count() as usize);
        assert_eq!(set(&ids(&repo, &view)), set(&expected), "{args:?}");
    }
}
