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
- First version of the finch-on-a-branch logo, with app icons for every platform, shown in the
  title bar, the Welcome tab and About.
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
- The synthetic repository generator now packs refs like a clone does and keeps a million
  commits within about 15 years (it reached 2066 before).
