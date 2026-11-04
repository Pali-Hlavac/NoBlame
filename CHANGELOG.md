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
  **Not yet:** syntax highlighting (slice 3c).
- Diff options (M3): side by side (old version left, new right, scrolling sideways together),
  ignoring whitespace at line ends, changes in amount or all whitespace (as `git diff
--ignore-space-at-eol`, `-b`, `-w`), and 3, 10 or 25 lines of context or the whole file. Set
  in the Diff tab's header or Settings → Diff, and remembered.
- Word diff (M3): in an edited line, the words that changed are marked in a stronger colour, in
  both layouts.
- Image previews in the Diff tab (M3): PNG, JPEG, GIF, WebP, BMP, ICO and AVIF files are shown
  before and after, with pixel and byte sizes. Files that `.gitattributes` mark `binary` or
  `-diff` are shown as binary; `diff` forces a text diff.
- Syntax colours in the Diff tab (M3): code is coloured by its language (via syntect). Files over 4 MB are not coloured; Settings → Diff can switch
  it off.
- Filter bar in the repository tab (M3, ADR 0021):
  - show the history of all branches, the current branch, or one branch or tag;
  - follow only first parents, and hide merges;
  - the bar counts the shown commits, and **Clear** shows everything again;
  - lines join each commit to its nearest shown ancestors;
  - Commit details still shows real parents, and greys out the ones the filter hides;
  - on the Linux kernel (1.5M commits) a change takes under a quarter of a second.

- Message and author search in the filter bar (M3):
  - finds commits whose message, or whose author's name or e-mail, contains the text, ignoring
    case;
  - applies when typing pauses, or on Enter;
  - commits are read on several threads: 1–2 s on the Linux kernel, against 13 s for
    `git log --author`.

- The diff tab's context is set with **−** and **+** buttons (0 to 100 lines) and a separate
  **Whole file** switch; switching it off restores the number of lines.
- Syntax colours for many more languages: the 213 grammars `bat` ships (via two-face), including
  TypeScript, TSX, TOML, Kotlin, Swift, Dockerfile, Vue, Svelte, SCSS, Terraform and Nix.
- The sidebar keeps its width in pixels when the window is resized.
- Branches can be sorted by last commit (newest first, with each commit's date) as well as by
  name; the choice is saved (Settings → Branches).
- Diff tab keeps its place: changing the context, the whitespace option or the layout keeps the
  line in the middle of the view where it was; the old diff stays under a light blur until the
  new one is ready, instead of the tab going blank.
- Copy code from the diff: lines can be selected, and copying leaves out line numbers, `+` and
  `-` and hunk headers; side by side copies the side the selection started in.
- A loading bird: a flat songbird singing notes replaces the spinner everywhere, and covers the
  window at start with the app blurred behind it, until everything has loaded (at most 5 s).
  The bird is a songbird chirping on a berry branch, drawn inline from one definition
  (`loadingBird.ts`), so it shows from the first frame.
- Repository groups in the Repositories module (owner request 2026-11-02): folders of
  repositories like bookmarks. Create and rename them in place, drag repositories onto them (or
  right-click → Add to group), reorder repositories and groups by dragging, fold them, open a
  whole group at once; a grouped repository shows its submodules below it. Saved in
  `repository-groups.json`. **Placeholders:** Pull all and Push
  all on a group are listed disabled (M5).
- The Repositories module's sections (Open, Groups, Recent) fold when their title is clicked
  and can be reordered by dragging the title (or Alt+Up / Alt+Down); both are kept in Settings.
- Owner feedback (2026-11-02):
  - holding Ctrl (Cmd) over another commit shows "Click to compare with <the selected commit>"
    at the pointer;
  - text in the diff and file tabs can be selected by starting the drag after the end of a line;
  - scrollbars are drawn by the app, thin and in the theme's colours, the same on every system;
  - the window can be moved by dragging the start screen, before the title bar is there;
  - Ctrl+P and Ctrl+Shift+P (print) are blocked in development builds too; reloading and the
    browser's context menu stay available there.
- The owner's refreshed logo artwork (2026-11-03): new finch app icons for every platform, a new
  hand-made Windows icon and a new songbird in the title bar, the Welcome tab, About and task
  windows.
- Colours (owner request 2026-11-03): icons are coloured by kind of work, the same in the
  activity bar, the toolbar, the command palette, menus and the Repositories module: green
  commits and committing, amber stashes, teal history, violet branches and remotes, blue
  repositories, orange groups, purple submodules. All are theme tokens in one place.
- Initials badges: a round badge with a person's initials beside the author in the commit list
  and the author and committer in Commit details, coloured by a hash of the e-mail address, so
  it is the same on every device.
- Repositories in groups and initialized submodules have the **…** button too (Copy path, Open
  or Close, Remove from group, and the Pull, Fetch, Push and Commit placeholders).
- Uncommitted changes (M4, slice 1): selecting **Working tree changes** or **Staged changes**
  above the commits lists their files in Changed files (changed, new `?` and conflicted `U`
  files, or the staged ones), and choosing one shows its diff: staged files against the last
  commit, the others against the staged version, read from disk as Git would store them (line
  endings, filters). One `git status` run gives the counts and both lists (about 260 ms for the
  97,000 entries of the Linux kernel clone, 40 ms for the 40,000 files of synthetic-1m). New
  files are counted and listed one by one unless `status.showUntrackedFiles` is `no`.
- Stashes (M4, slice 5): **Stash changes…** in the Stashes module stashes all or only the ticked
  files, with a message, optionally new files and keeping the staged changes; clicking a stash
  opens a Stash tab with its files and diffs; **Apply**, **Pop** (optionally restoring the
  staged changes) and **Drop…** (after a confirmation naming the stash); **Apply N chosen**
  merges only the ticked files' changes into the working tree and keeps the stash. Conflicts are
  marked as by `git stash apply`. The commit graph labels the commit each stash was made on
  (`stash@{n}`).
- Compare with the working tree (M4 slice 6): a commit's menu → **Compare with the working
  tree**, or **Working tree** as the compare tab's second side. Lists what `git diff <commit>`
  lists, diffs against the files on disk, and updates when they change.
- The commit message (M4, slice 4): **Recent ▾** above the box puts one of your last commit
  messages back in it; the box starts with your `commit.template` (its `#` lines are left out,
  as Git does); **Author → Change** commits someone else's work as `Name <email>` with you as
  the committer; the summary's length shows against 50 and 72 characters, with a warning when
  line 2 is not empty.
- Popping modules out (owner request): right-click a module's tab in the sidebar → **Pop out**.
  From then on the module opens in a popup over the window (inside the app), and the rest of
  NoBlame waits until it is closed. Closing keeps what was typed or chosen in it; **Dock** puts it
  back in the sidebar, and the choice is kept with the layout. Popping out the Commit module
  replaces the Settings → Committing choice: the popup shows the diff beside the files and
  closes after a commit.
- Staging part of a file (M4, slice 3): in the diff of a changed or staged file, each hunk has
  **Stage hunk** and **Discard hunk…** (or **Unstage hunk**), and changed lines can be chosen by
  clicking their numbers (Shift+click for a range), then staged, unstaged or discarded from the
  bar above the diff. The Commit module discards whole files (**↶** on a row or for all), after a
  confirmation that names what is lost; new files are deleted, conflicts left alone. Nothing is
  written when the file changed since its diff was shown.
- Committing (M4, slice 2): the **Commit** module (Alt+7) lists the changed and the staged files;
  **+** / **−** on a file (or Space) stages or unstages it, **Stage all** / **Unstage all** move
  everything, and staging a conflicted file asks first. Write the message and press Ctrl+Enter
  (⌘Enter) or **Commit**; **Amend last commit** fills in the last message, **Sign off** adds
  `Signed-off-by:`. NoBlame runs your own `git commit`, so hooks, signing and your identity
  apply; when a hook refuses, its output is shown and the message kept. Popped out (see
  above), it shows the diff beside the files. The toolbar's **Commit**
  button, the palette's **Commit…** and a repository's **…** → **Commit…** open it. File
  names are passed to git literally, so a file named `[ab].txt` is not read as a pattern.
- Commit graph columns (M3, slice 11, owner request 2026-11-02): show or hide columns, move them
  by dragging their titles, resize them by dragging their edges (or with the arrow keys), and
  show dates as "3 h ago" instead of the date and time. From the column header's right-click
  menu or columns button, or Settings → Commit graph. The column titles now line up with the
  rows when the list has a scrollbar.
- Commit details (M3, slice 10): the commit's children (click to select; from the graph, 5.6 ms
  for the oldest of the Linux kernel's 1.5M commits), and for a signed commit whether the
  signature is good, who signed it, the key and what gpg, ssh-keygen or gpgsm said. Checked with
  the user's git (`git log --format=%G?`) once the selection rests for 0.3 s, and again when the
  window regains focus.
- Compare tab: the files that differ between two branches, tags or commits, with the diff of
  the chosen one. Open it with **Compare with HEAD** in a commit's menu, **Compare with the
  current branch** in a branch's or tag's submenu, Ctrl+click on a second commit, or the palette.
  Each side is picked from the references or typed (`HEAD~3`); a swap button and **Only changes
  since they split** (`git diff A...B`); the line below counts the files and the commits only
  each side has. It runs `git diff --raw`, about 20 times faster than gix's rename detection on
  git.git, and gix in partial clones (ADR 0023). Under a second for 116,665 files on the Linux
  kernel. Comparing with the working tree is shown disabled until M4.
- Blame: right-click a file in Files (or **Blame** in the File tab) to see, beside each line,
  the commit that last changed it (id, date, author, summary). Click a commit to select it;
  right-click it to show its change or to **blame the previous revision**, and **Back** to
  return. It runs the installed git (`git blame`), so `blame.ignoreRevsFile` and `.mailmap`
  apply; on git.git it is 1.4–2 times faster than gix's blame (ADR 0022). Partial clones never
  download missing contents for it.
- File history: right-click a file or folder in Files (or **History** in the File tab) for the
  commits that change it, newest first, following renames. Unlike `git log --follow`, a file
  renamed on one branch and edited under its old name on another keeps both histories
  (ADR 0022). Moving onto a commit selects it and shows the file's change in the Diff tab. On
  git.git, `builtin/log.c` takes 1.3 s for 863 commits (`git log --follow`: 8.4 s, 589).
- Files module (Alt+6): the folders and files of the selected commit, read as folders are
  opened (a 1,600-entry folder of the Linux kernel in a few milliseconds), with tree keys
  (Right/Left open, close and move) and a context menu. Showing a file opens the **File** tab:
  the whole file with line numbers and syntax colours, or the picture for images. **Save as…**
  writes it exactly as the repository stores it. "Browse files at this commit" in the commit
  menu now works.
- Find commits (Ctrl+F):
  - matches ids, branch and tag names, authors and messages;
  - Enter and Shift+Enter step through the matches ("3 of 120").
- Go to commit (Ctrl+Shift+G): any id, branch, tag or `HEAD~2`; offers to clear a filter that
  hides the commit.
- Context menu on commits in the graph (right click, Shift+F10):
  - copy the id, short id, subject or whole message;
  - highlight the commit's history;
  - a submenu per branch and tag, with Copy name;
  - check out, branches, merge, rebase, cherry-pick, revert, reset, bisect, patches and scripts
    are listed disabled, with the milestone that brings them.
- Path filter in the filter bar (M3): shows only the commits that change a file or folder (a
  git pathspec such as `src/` or `*.rs`), as `git log -- <path>` lists them. Pasted absolute
  paths inside the repository are accepted.

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

- Diffs failed in a work tree without an index (for example after `git clone --no-checkout`)
  while reading `.gitattributes`.
- Right-clicking a row in Changed files or Branches no longer activates it; it only
  moves the cursor there.
- The window no longer opens white: it starts in the theme's background colour with the
  singing bird, drawn in the page itself, until the app has loaded (seconds in dev).
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
- Reported by the owner (2026-11-02):
  - clicking the oldest commit of a long history, scrolled to the end, moved the list up by
    most of a row and cut that row off (fractional display scaling rounds the end of the list
    differently; revealing a row now puts it exactly on the bottom edge);
  - closing the last tab in one half of a split could switch the other half to another
    repository; the tab already on screen stays.
