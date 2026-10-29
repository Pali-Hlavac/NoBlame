//! Filtered graphs checked against `git log`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::collections::BTreeSet;
use std::sync::Arc;

use git_core::graph::{
    Graph, GraphFilter, MAX_ROWS_PER_PAGE, RefKind, RefSelector, Tips, commit_details, commit_rows,
};
use git_core::repo::Repository;
use noblame_repo_gen::{Preset, generate};

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
