# Changelog

All notable changes to NoBlame are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- M1 scaffold: Cargo workspace (`crates/git-core` without Tauri, `crates/repo-gen`,
  `src-tauri`) and a Tauri 2 + React 19 + TypeScript + Tailwind 4 + shadcn/ui frontend.
- Typed IPC with tauri-specta, one error model (`AppError { code, message, hint }`) and strict
  per-window capabilities (`main`, `task-*`).
- The finch-on-a-branch logo, with app icons for every platform, shown in the title bar, the
  Welcome tab and About. The drawn first version was replaced by the owner's painted finch
  (2026-10-29), with a hand-made Windows `.ico`; the title bar shows the songbird larger, on a
  transparent background.
- Main window: repository sidebar, tabs, status bar, command palette (`Ctrl+K` / `⌘K`),
  system/light/dark theme (saved), About dialog.
- Repository tabs from the folder picker, the recent list or the command line.
- Opening repositories (M2): subfolders resolve to the repository; normal, bare, linked worktree
  and submodule repositories, shallow clones and detached HEAD are recognized; repositories git
  would refuse (owned by another user, not in `safe.directory`) are refused with the command to
  trust them, which NoBlame never runs itself.
- Commit graph (M2): the full history drawn on a virtualized canvas with message, author, date
  and commit columns, branch, remote-branch and tag labels, the current branch outlined, HEAD
  selected on open, keyboard navigation (arrows, Page Up/Down, Home/End). The first screen of
  a million-commit repository is ready in about 0.6 s (release build, commit-graph file present,
  packed refs; measured outside the UI).
- Workbench (M2.5): an activity bar opens modules (Repositories for now) in a left dock where
  they stack as tabs or split; repository tabs can be split and docked in every direction; the
  layout and the open tabs are restored on the next start; "Reset layout" in the palette; F6 /
  Shift+F6 move focus between regions, Alt+1 opens Repositories. The commit list hides the
  commit, author and date columns one by one when its pane gets narrow.
- Custom title bar on the main window, holding the toolbar, the active repository and the
  palette button, so the module tabs and the document tabs line up. Windows and Linux get
  NoBlame's own minimize, maximize and close buttons; macOS keeps its traffic lights.
- Toolbar for the active repository: Pull with a menu (Pull, Fetch, Fetch all remotes, Fetch
  and prune), Push, Commit, Stashes, and the active repository with its current branch.
  **Placeholders:** Pull, Fetch and Push arrive in M5 and Commit in M4; their buttons are
  disabled and say so. Stashes opens the Stashes module.
- Repositories module (Alt+1): open repositories with their submodules nested below them
  (recursively), then recent repositories; a click opens or focuses the repository's tab.
  Submodules that are not initialized are dimmed (initializing them arrives in M7).
- Branches module (Alt+2): local branches, each remote's branches and tags in collapsible
  sections with a filter; the current branch is marked; a click selects the branch's commit in
  the graph. Read-only for now (checkout, create, delete and the other actions arrive in M5).
  The list renders only visible rows, so 10,000 refs stay fast.
- Stashes module (Alt+4): the stash list (message, branch, date), refreshed when the window
  regains focus. **Read-only:** creating, applying, popping and dropping stashes and applying
  single files arrive in M4.
- Commit details module (Alt+3): message, commit id (copy), parents (click to select), author
  and committer with their time zones, refs, and the branches, remote branches and tags that
  contain the commit (computed from the graph: 5.5 ms for the oldest of a million commits).
  It follows the commit selected in the active repository: the repository tab focused last.
- Changed files module (M3, Alt+5): the files the selected commit changed, with status letters,
  renames and copies (as your git config detects them), and a parent choice for merge commits.
  The chosen file stays chosen when another commit is selected. Uncommitted files arrive in M4.
- Diff tab (M3, ADR 0013): choosing a file in Changed files shows its unified diff in one tab
  that opens beside the graph and then stays where it is docked. Shows hunks, old and new line
  numbers, "No newline at end of file", and the added and removed line counts. Binary files,
  files over 64 MB, renames without changes, submodule pointers and file versions missing from
  a partial clone each get their own message. Diffs are computed in Rust with gix (honouring
  `diff.algorithm`) and paged: a 200,000-line file with 2,000 edits diffs in 46 ms.
  **Not yet:** side by side, syntax highlighting, whitespace options, word diff, images (slice 3).
- The commit-graph offer explains what the file is (one index file in `.git`; commits, branches
  and files do not change) and, after a load slower than 2 s, is highlighted with how long
  loading took and how long writing the file would take. It is still only written on request.
- Faster graph layout for wide histories: the Linux kernel (1.5M commits, 702 lanes) lays out
  in 150 ms instead of 1.5 s, and shows its first screen in under half a second when it has a
  commit-graph file.
- Graph cache (M2, ADR 0010): rebuilding the graph after a change reads only new commits, and
  the commit index is saved in the app's cache folder, so reopening a repository does the same.
  Without a commit-graph file, indexing 100,000 commits drops from 368 ms to 4 ms.
- Live updates (M2): open repositories are watched. Editing files updates the uncommitted
  changes; a commit, checkout, fetch or stash made elsewhere reloads the header, graph,
  Branches, Stashes and Commit details, keeping the selected commit (or following HEAD).
  Ignored files (`.gitignore`) are not watched. New dependencies: `notify` 8.2.0 (CC0-1.0) and
  `notify-debouncer-mini` 0.7.0 (MIT/Apache-2.0).
- Uncommitted changes in the commit graph (M2): "Working tree changes" and "Staged changes" rows
  above the newest commit, with counts, joined to HEAD by a dashed line, selectable (Commit
  details shows the counts). Refreshed when the window regains focus. Settings can show a
  summary in the repository header instead, or hide them. **Placeholder:** the file lists and
  staging arrive in M4.
- Settings tab, opened by the gear at the bottom of the activity bar, `Ctrl+,` / `⌘,` or the
  palette: theme, the commit highlight and the repository actions button. **Placeholder:**
  configurable keyboard shortcuts are listed as arriving in M7.
- Selecting a commit highlights its history (the lines leading into it stay bright, the rest
  fades) and the commits by the same author; Esc clears it. Finding the history of the newest
  of a million commits takes 3.5 ms.
- "…" button on open repositories in the Repositories module: Copy path and Close.
  **Placeholders:** Pull, Fetch and Push (M5) and Commit… (M4) are listed disabled. Settings can
  hide the button.
- Welcome tab dashboard: recent repositories (missing folders dimmed, removable) and "Create
  repository…" (`git init`), also offered when a folder is not a repository.
- A notice offers to write the commit-graph file when a repository has none; it runs
  `git commit-graph write` with `--reachable --changed-paths`.
- Benchmarks (`pnpm bench`) for building the graph on generated repositories.
- Git detection: finds the installed git (`NOBLAME_GIT`, `PATH`, well-known folders), shows its
  version in the status bar and About, warns below git 2.39 and explains how to install it.
- Safe git command runner in `git-core`: argument arrays only, validated revisions, paths after
  `--`, fixed locale, no terminal prompts, `--no-optional-locks` for reads, no console window,
  cancellation.
- Command line: `noblame [path]`, `noblame browse [path]` and 14 task commands
  (`noblame commit <path>`, ...). A second launch forwards its arguments to the running app.
  **Placeholder:** task windows show their task and path only; the task UIs arrive in M8.
- Synthetic repository generator (`pnpm repos:generate`): deterministic repositories with 10k,
  100k or 1M commits, merges, octopus merges, thousands of branches and tags.
- Tooling: ESLint, Prettier, rustfmt, clippy (pedantic), file-size check, husky + lint-staged +
  commitlint, CI on Linux, Windows and macOS.
- Documentation: project brief, getting started, architecture, feature pages, user guide,
  ADRs 0001–0007 and 0015, development guides.

### Fixed

- Found during M1 verification: `noblame .` opened a tab named "." and forwarded paths kept
  mixed separators on Windows; command-line paths are now normalized.
- Found during M1 verification: typing "about" in the command palette selected "Close current
  tab"; search now ranks by the visible label.
- Found during M2 verification: a repository passed to `noblame <path>` when the app was not
  running yet opened no tab.
- Found during M2.5 verification: new tabs and modules opened in a new dock group each time
  instead of joining the focused group.
- Reported by the owner after M2.5:
  - the sidebar splitter could not be dragged;
  - resizing the window flashed scrollbars on every frame;
  - dragging tabs between groups did nothing (Tauri's file-drop handler blocked HTML drag and
    drop);
  - opening a submodule listed it as another top-level repository instead of highlighting it
    inside its parent.
- Reported by the owner in the second review: scrollbars still flickered while resizing. The dock
  tab strips showed their scrollbar during every resize, and the commit list's sticky layer was
  a frame too tall on short histories.
- Scrollbars blinking on every frame in the sidebar and the tab area after resizing, at 150 %
  display scaling: the splitter's panels scrolled by default, and their fractional width made
  the docks overflow by half a pixel, then fit, then overflow again.
- A remount of the workbench (a hot reload in development) replaced the open tabs with the tabs
  restored at start; a saved layout is now applied once.
- The synthetic repository generator now packs refs like a clone does and keeps a million
  commits within about 15 years (it reached 2066 before).
