# Changelog

All notable changes to NoBlame are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The Remotes dialog became the remote editor: remotes on the left, the chosen one's settings
  on the right in tabs. **General**: name, URL, several push URLs, the default branch and what
  fetching does when the server's default branch changes (git 2.48+). **Advanced**: every
  `remote.<name>.*` value, several per key, with values from your user or system settings shown
  with their file, and the address rewrites that apply. Changes are collected, reviewed as the
  Git commands that will run, and saved all or nothing (ADR 0024).
- The remote editor's **Fetch** tab (every branch or only named branches and patterns, tags,
  removing what was deleted on the server, leaving a remote out of Fetch all, fetch now) and
  **Push** tab (the default remote for pushing, mirror with a confirmation, the repository's push
  options), and a search over all tabs (Ctrl+F) by name, help text or Git setting name.
- The remote editor's **Branches** tab: the branches tracking the remote with their upstream,
  where they push and how they pull, making another branch track it, and how the repository
  pulls. Adding a remote offers the original of a fork as `upstream` and keeps pushing to
  `origin`.
- The remote editor talks to the server: **Test connection** (with a plain-words reason when
  it fails), **Ask the server** for its default branch, **Use SSH / Use HTTPS** for GitHub,
  GitLab, Bitbucket and Azure DevOps, **Open in browser**, moving a password written into a URL
  to the credential helper, and moving a server's proxy and certificate settings along when the
  URL moves to another server.
- The remote editor's **Connection** tab: proxy, certificate checks and files, the Windows
  certificate store, client certificates, extra headers, HTTP version and slow-connection limits
  for the remote's server, and an **SSH key** per remote that NoBlame uses when it fetches,
  pulls, pushes or tests that remote.
- NoBlame is free software under the GNU General Public License, version 3 or later
  (`LICENSE`); About says so.

### Changed

- Passwords written into remote URLs no longer reach the window when a remote is edited: they
  show as `***` and are kept when saved unchanged (the old edit form received them).

## [0.2.1] - 2026-11-18

### Fixed

- The app icon chosen in Settings now shows on the Windows taskbar when NoBlame was installed
  and started from its shortcut; it showed the cream icon whatever was chosen. Windows showing
  Vibrant or Free get a taskbar identity of their own, so pinning one keeps its icon.

## [0.2.0] - 2026-11-18

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
- `.gitignore` helper (M4 slice 6): **Ignore…** on untracked files in the Commit module offers
  the file, its name, its extension or its folder as a pattern (or a typed one), lists the files
  it would hide, and adds it to `.gitignore` or `.git/info/exclude`.
- External diff tool (M4 slice 6): **Open in diff tool** beside the file name in every diff opens
  the two versions in Git's `diff.tool`, Visual Studio Code or a command of your own
  (Settings → Diff), through `git difftool --no-index`.
- Merging (M6 slice 1): **Merge into the current branch…** on a commit, on a branch, remote
  branch or tag (graph and Branches module), with fast-forward when possible, always a merge
  commit, fast-forward only, or squash. When files conflict, or any operation is in progress
  (merge, rebase, cherry-pick, revert, also started elsewhere), a bar above the commits names it,
  counts the conflicted files and offers **Continue**, **Skip** and **Abort** (after asking).
- Cherry-pick, revert and reset (M6 slice 2) in the commit menu. **Cherry-pick…** and
  **Revert…** commit at once or only stage, can note where a picked commit came from (`-x`), and
  ask which parent counts for a merge commit; a pick the branch already has is reported and
  left out, and conflicts bring up the bar. **Reset the current branch to here…** offers soft,
  mixed, keep my changes and hard, and names before it runs the commits that leave the branch
  and, for hard, how many files lose their uncommitted changes.
- Rebase (M6 slice 3): **Rebase the current branch onto this…** on commits, branches, remote
  branches and tags, in the graph and the Branches module. The dialog lists the commits that
  are replayed, warns when some were pushed already, can stash uncommitted changes meanwhile and
  keep merge commits. A rebase that stops on conflicts shows the bar with its step ("Rebasing
  topic (step 2 of 3)"); Continue and Skip say whether it finished or stopped again.
- Conflicts (M6 slice 4): **Resolve…** in the bar (and **Resolve conflicts…** on a conflicted
  file in the Commit module) lists the conflicted files and says who "ours" and "theirs" are.
  Each file can be opened in the merge tool, resolved with **Use ours** or **Use theirs**
  (deleting it where that side did), or marked resolved after editing; either side also works
  for all files at once. **Settings → Diff → Merge tool for conflicts** chooses Git's
  `merge.tool`, Visual Studio Code, Beyond Compare, KDiff3, Meld, P4Merge or another tool Git
  knows; it runs through `git mergetool`.
- Commit graph: **Rest of the message** (column menu, Settings → Commit graph) shows each
  commit's message body, greyed, after its subject (owner request 2026-11-13).
- Module stacks: **Stack with** in a module tab's or icon's menu shows modules one above the
  other in one tab (Commit details over Changed files), framed together in the activity bar;
  **Add to this stack**, **Take out of the stack**, **Unstack**; the shares of the height are
  saved (owner request 2026-11-13).
- Activity bar: drag icons to reorder them (stacks move together), **Move up** / **Move down**,
  **Hide** icons under a **…** button above Settings, **Lock the icons**, **Reset the order**;
  saved with the layout (owner request 2026-11-13).
- Settings: a search box; only the settings matching every word stay shown (owner request
  2026-11-16).
- Command palette: **Create a branch…**, at the commit selected in the graph or else at HEAD
  (owner request 2026-11-16).
- Commit module: more room for the lists (owner request 2026-11-16): a splitter between
  Changes and Staged; the message box is one line until used and grows with the message;
  Amend, Sign off, the author and Commit share one row; **Message** folds the area to one line;
  popped out, the lists and the diff have a splitter. All remembered.
- A submodule's commit graph labels the commits its superproject's local branches record
  (`app: main`; owner request 2026-11-16).
- Submodules follow their repository (owner request 2026-11-16): fetch includes them
  (Settings → Submodules, on); pull and checkout can update them (setting, off); a bar offers
  the update when submodules are not on the recorded commits; **Check out the recorded commit**
  on a changed submodule in the Commit module and Changed files.
- Repositories module: submodules show their uncommitted file counts too (Settings →
  Repositories; owner request 2026-11-16).
- Commit graph: a branch whose upstream is at another commit has an arrow in its label (up or
  down), and the upstream's label one back; clicking it selects the other commit (owner request
  2026-11-16, as in Git Extensions).
- Files module: a filter box; the whole tree of the commit is searched for the paths holding
  every word typed, shown with their folders opened (`search_tree`; 43 ms on the Linux kernel's
  97,310 files; owner request 2026-11-16).
- Tabs: closing the focused tab shows the tab used before it, also after tabs were moved or a
  split closed, instead of its neighbour (owner request 2026-11-16).
- Commit graph: choosing a working tree row highlights HEAD's history, as choosing HEAD does
  (owner request 2026-11-16).
- Commit module: choose several files (Ctrl+click, Shift+click, Ctrl+Shift+click, Shift+arrows,
  Ctrl+A) and stage, unstage or discard them together with Space, a row's button or the menu
  (owner request 2026-11-13).
- Icons in the commit graph's and the Branches module's context menus, coloured by the kind of
  work each action does: a branch icon before branches, a globe before remote branches
  (owner request 2026-11-13).
- Commit module: Settings → Commit can list files folder first, sorted by the whole path,
  instead of name first (owner request 2026-11-13).
- Updates (M9 slice 6, ADR 0017): release builds look for a new version shortly after starting
  (Settings → Updates), offer it with its notes, and install it and restart on request, with
  signatures checked against NoBlame's key; About and the palette check on demand. Builds from
  source say they do not update. A release workflow builds signed installers for Windows, macOS
  and Linux into a draft GitHub release with the update feed; `pnpm release:version` sets the
  version everywhere; `docs/development/release.md` describes a release end to end.
- Third-party licences (M9 slice 5): About → **Third-party licences…** lists every open-source
  component with its licence (Rust crates, JavaScript packages, syntax grammars), searchable;
  installers include the same `third-party-notices.txt`. `pnpm licences` regenerates it, and CI
  checks it is current.
- End-to-end smoke tests (M9 slice 4, ADR 0016): `pnpm e2e` drives the real app through
  tauri-driver on a fixture repository (open, browse, commit, create a branch, merge), in CI on
  Linux and Windows. `NOBLAME_PROFILE_DIR` runs NoBlame with its own settings and caches, apart
  from a NoBlame already running.
- Keyboard and accessibility pass (M9 slice 3): shortcuts for Open repository (Ctrl+O), Fetch
  (Ctrl+Shift+F), Pull (Ctrl+Shift+P), Push (Ctrl+P), Create a branch (Ctrl+Shift+N) and Stash
  changes (Ctrl+Shift+S, also a new palette command), changeable in Settings; every text colour
  meets WCAG contrast in both themes (a deeper gold focus ring and HEAD outline, darker warning
  text, dark text on red buttons in the dark theme); list rows no longer hold buttons screen
  readers would stumble on; the Branches filter shows focus. `pnpm test:a11y` audits the UI
  with axe-core.
- A third app icon, the finch without a background (Settings → Appearance → App icon).
- Window places and filters remembered (M9 slice 2): the main window opens where it was
  closed (position, size, maximized; moved back onto a screen if that monitor is gone), each
  kind of task window at its last size, and each repository shows the graph filter it had in
  the main window.
- App icons (M9 slice 1): Settings → Appearance → **App icon**, Cream, Vibrant or Free (no
  background), changes the icon of every NoBlame window at once (taskbar, Alt+Tab, title bars)
  with the hand-made picture for each size on Windows. On macOS, Cream or Vibrant becomes the
  Dock icon while NoBlame runs. The installed program keeps the cream icon. Each system has its
  own pictures (`assets/logo/windows`, `mac`, `linux`); macOS gets the owner's `.icns`.
- Clone and Create repository windows (M8 slice 6): `noblame clone <folder>` shows the Clone
  form cloning into a new folder there, git's output while it runs, then **Open in NoBlame**;
  `noblame init <folder>` says what is there first (a new folder, files that stay, a repository
  already, or a folder inside another repository) and then creates the repository. Each task's
  `--help` now says what its path is; the command line reference in `docs/features/cli.md` quotes
  `noblame --help`, checked by tests. **M8 (task windows) is done.**
- Switch, Merge, Rebase and Stash windows (M8 slice 5): `noblame switch|merge|rebase <path>`
  asks which branch, remote branch or tag (filtered as you type; a commit id or `HEAD~2` can be
  typed too; merging and rebasing start on the upstream), then works as the graph's menu: a
  local branch is checked out at once, a remote branch gets its local branch, merging and
  rebasing ask how. While a merge or rebase is unfinished the window says so instead.
  `noblame stash <path>` shows the stashes and opens **Stash changes**; given a folder, only
  that folder's changes are listed and stashed.
- Settings → Task windows → **Close a task window once its action succeeded** (off by
  default): a Commit, Pull, Push, Fetch, Switch, Merge, Rebase or Stash window closes 1.5 s
  after its commit, job, checkout, merge, rebase or stash worked; failures and conflicts keep it
  open (owner request 2026-11-12).
- Fetch, Pull and Push windows (M8 slice 4): `noblame fetch|pull|push <path>` opens the
  repository's graph with its question at once (Fetch from where, Pull how, the Push dialog),
  and again from the window's bar; git's output shows in the window while the job runs. Job
  toasts and the Git output window now show only in the window that started the job.
- Blame and File history windows (M8 slice 3): `noblame blame <file>` blames the file as it is
  in the last commit, `noblame filehistory <path>` lists the commits that changed a file or
  folder; the chosen commit's details and files show beside them. Blame on a folder says it
  needs a file.
- Commit and Diff windows (M8 slice 2): `noblame commit <path>` shows the Commit module beside
  the diff, and `noblame diff <path>` the changed files beside it, both limited to the folder or
  file given (`git status` looks only there). **Stage all** and **Unstage all** act on that
  path; the Commit form says how many files staged elsewhere a commit would take too. Opened on
  a file, the window shows its diff at once.
- Task windows (M8 slice 1): `noblame log <path>` opens a Log window with the commit graph,
  only the commits that changed the folder or file given (shown in the filter bar), and
  Branches, Commit details, Changed files and Files beside it. A bar names the task, the
  repository and the path, with **Open in NoBlame** to show the repository in the main window.
  The same task on the same path brings its window to the front instead of opening another;
  closing the main window leaves task windows open; a window's repositories are closed with it.
- Keyboard shortcuts (M7 slice 8): **Settings → Keyboard shortcuts** lists every shortcut by
  where it works, and each can be changed: click its keys and press new ones (Esc cancels,
  Backspace leaves it without one). Keys another shortcut has are refused naming it, as are
  plain letters, copy/paste/undo and Alt+F4. Changes apply at once, also in the palette and the
  tooltips, and are kept with the settings; one shortcut or all can be reset.
- Git settings (M7 slice 7): **Settings → Git settings** shows and changes Git's own settings,
  first choosing whose: this repository's (`.git/config`) or your user settings (every
  repository), with the file named. Common settings are listed with what they do (your name and
  email, pulling by rebasing, pruning, line endings, signing, …); the file's others follow, and
  any setting can be added. Nothing is written until Save, Remove or Add.
- User scripts (M7 slice 6): **Settings → Scripts** saves git commands with placeholders
  (`{sha}`, `{short}`, `{subject}`, `{branch}`, `{repo}`), such as `log --stat -1 {sha}`.
  Right-click a commit → **More** → **Run a script** runs one as a background job; its output is
  in the jobs list and the Git output window. No shell is involved: a value with spaces stays
  one argument, and one that would read as an option is refused.
- Git LFS (M7 slice 5): the **Git LFS** module (Alt+0) lists a repository's LFS files with their
  sizes, marks those that are **pointer only** (content not downloaded), and **Download
  contents** runs `git lfs pull` as a background job. **Show locks** asks the LFS server who
  holds which file; lock a file from its row, **Unlock** (forcing someone else's lock asks
  first). Without git-lfs, or without an LFS server, the module says so.
- Patches and archives (M7 slice 4): right-click a commit → **More** → **Create patches…**
  saves the patches of that commit, or of the commits after a branch, tag or commit, into one
  file or one file per commit (merges are left out; files already in the folder are never
  replaced). **Apply patches…** (the **Commit** button's menu, or the palette) shows what the
  chosen files hold and checks them first (cleanly, with a three-way merge, with conflicts, or
  not at all), then makes commits from them (`git am`) or only changes the files
  (`git apply`). **Save an archive…** writes a commit's files as a zip or tar.gz as a
  background job, named after its tag.
- Bisect (M7 slice 3): right-click a commit → **More** → **Bisect: mark as bad** (or good) to
  find the commit that brought a problem in. NoBlame checks out the commit halfway between;
  the bar above the commits says how many are left and has **Good**, **Bad** and **Skip** for
  it, until it names the first bad commit (**Show it**, **Stop bisecting**). The marks show as
  `bad`, `good` and `skipped` labels in the graph.
- Worktrees (M7 slice 2): the **Worktrees** module (Alt+9) lists a repository's worktrees;
  click one to open it in a tab. **Add a worktree…** checks out a new branch, a branch or a
  commit in a new folder; right-click a worktree to **Lock…**, **Unlock** or **Remove…** it
  (uncommitted files are named first); **Prune** forgets worktrees whose folders are gone.
- Submodules (M7 slice 1): the Repositories module shows submodules that are not initialized
  and ones with **new commits** (checked out at another commit than recorded). Right-click a
  submodule for **Initialize** or **Update to the recorded commit**; a repository's **…** menu
  has **Update all submodules**. They run in the background with progress; moving submodules
  that have new commits asks first. The diff of a submodule shows the commits between its two
  pointers, and whether it has changed or untracked files of its own.
- The reflog (M6 slice 7): the **Reflog** module (Alt+8) lists where HEAD or a branch pointed
  before each change, newest first. Choosing an entry selects its commit (or says only the
  reflog has it); right-click for **Restore this state…** (the reset window, starting on Keep my
  changes), **Create a branch here…**, **Check out this commit…** and **Copy commit id**.
- The interactive rebase (M6 slice 6): **Interactive rebase from here…** in the commit menu
  lists that commit and the ones after it, oldest first. Move them, and pick, reword, edit,
  squash, fix up or drop each; new messages are typed in place, and **Arrange fixup! commits**
  puts `fixup!` and `squash!` commits under the commits they name. Commits that were pushed
  already are named first.
- The merge view (M6 slice 5): **Merge** on a conflicted file (in Resolve conflicts, or
  **Merge in NoBlame** in the Commit module) opens it in the **Merge** tab. Lines only one side
  changed are taken already; each conflict shows ours and theirs side by side (and the base on
  request) and is decided with Use ours, Use theirs, both in either order, or an edit. **Save
  and mark resolved** stages the file and writes it with your line-ending settings.
- A context menu on files in every list (owner request 2026-11-09): Changed files, the Commit
  module, Compare and the Stash tab offer **Show diff** (and Stage, Discard, Ignore in the Commit
  module), **Open working tree file** (refusing files that would run as programs), **Show in
  Explorer** / Finder, **Save this version as…**, **Copy path**, **Copy full path**, **Copy
  name**, **File history** and **Blame**. The Files tree gained Open and Show in Explorer.
- Feedback for every action (owner request 2026-11-09): Fetch, Pull, Push and Clone show a
  toast the moment they are chosen, which follows the job (title, git's phase, a small progress
  bar, **Cancel**) and turns into its result; Pull all and Push all have one toast counting the
  repositories. A thin strip along the bottom of the window moves while anything runs, and
  changes that take a moment (checkout, commit, stash, discard, …) name themselves in the status
  bar ("Checking out the branch…").
- Remotes and clone (M5 slice 8): a **Remotes** dialog (Pull ▾ → Remotes…, the Branches
  module, the palette) adds a remote and fetches it, renames it, changes its URL and push URL,
  and removes it after naming the branches that go. **Clone repository…** (Welcome tab,
  Repositories module, palette) clones as a background job with branch, shallow, single
  branch, partial clone (blobless, treeless) and submodule options, opens the repository when
  done, and removes the half-cloned folder when cancelled. **Fetch all remotes** now fetches
  one remote after the other, so its progress shows.
- Git output window (M5 slice 7, owner request 2026-10-30): with **Settings → Fetch, pull and
  push → Show git's output in a window**, fetches, pulls and pushes open a console beside your
  work that streams what git prints, its progress and the result, with Cancel and Copy output.
  It closes by itself when they all succeeded (a setting) and stays open on a failure. Any job
  in the jobs list can be shown in it. Job logs are now read a few new lines at a time.
- Pull and push in the Repositories module (M5 slice 6): a repository's **…** menu pulls and
  pushes it, open or not (Push sends the current branch to its upstream), and a group's menu
  has **Pull all** (merge) and **Push all**, one job per repository with one summary toast at
  the end. **Settings → Repositories → Quick buttons** adds Pull and Push buttons to repository
  rows and Pull all and Push all to group rows; a button spins while its job runs.
- Pull and push (M5 slice 5): **Pull** (as configured, or choose merge, rebase or fast-forward
  only) and **Push** in the toolbar and the command palette, as background jobs. Push sends the
  current branch to its upstream, or asks where when it has none. **Push…** chooses the remote,
  the name there, the upstream, tags, and **force**: it lists the commits that would be removed
  first, and replaces the branch only if it is still where it was shown. Push tags and delete
  branches or tags on a remote from the Branches module and the graph's menus. Refusals come
  with the next step in plain words.
- Credentials (M5 slice 4): when Git's credential helpers and SSH agents have nothing, a
  fetch asks in the app for the user name and password (or token), the SSH key passphrase, or
  whether to trust an unknown SSH server. Nothing is stored by NoBlame; Git saves what you
  typed with your credential helper as usual. Credentials written into remote URLs are shown
  as `***` in job logs and messages.
- Fetch (M5 slice 3): **Fetch**, **Fetch all remotes** and **Fetch and prune** from the
  toolbar's Pull menu, the command palette and the Repositories module's "…" menu (open or
  closed repositories). Fetches run as background jobs: the status bar shows progress, and a
  jobs list offers Cancel, the log and the equivalent command; a toast says what changed or
  why it failed.
- Cancelling any git command now stops the programs it started too (`ssh`,
  `git-remote-https`, credential helpers): a job object on Windows, a process group elsewhere.
- Upstreams (M5 slice 2): local branches in the Branches module show how many commits are to
  push (↑) and to pull (↓) against their upstream, or that it is gone; **Set upstream…**,
  **Change upstream…** and **Remove upstream** in the right-click menu. Counted only for the
  rows on screen, so it stays fast with thousands of branches. An upstream changed in a
  terminal shows at once (the watcher now notices config changes).
- Branches and tags (M5 slice 1): check out a branch, a commit (detached HEAD, explained) or a
  remote branch (as a new branch tracking it); create, rename and delete branches; create
  (lightweight or annotated) and delete tags. From the graph's commit menu and a new right-click
  menu in the Branches module (F2 renames, Delete deletes). Deleting names the commits no other
  branch or tag holds; names are checked as they are typed; git's refusals are shown in its
  words. Git's messages in dialogs and toasts keep their line breaks.
- Uncommitted file counts in the Repositories module (M4 slice 7): with **Settings →
  Repositories → Show the number of uncommitted files beside repositories** (off by default),
  each repository shows `+new ~changed −deleted`. Open repositories use their live status;
  closed ones run `git status`, at most four at a time, again when the window regains focus.
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
  Task windows were placeholders until M8, which built every one of them.
- Synthetic repository generator (`pnpm repos:generate`): deterministic repositories with 10k,
  100k or 1M commits, merges, octopus merges, thousands of branches and tags.
- Tooling: ESLint, Prettier, rustfmt, clippy (pedantic), file-size check, husky + lint-staged +
  commitlint, CI on Linux, Windows and macOS.
- Dependency audit: `cargo-deny` checks Rust crates for advisories, yanked releases, licences
  (permissive and MPL-2.0 only) and sources (crates.io only); `pnpm audit` checks npm packages.
  Runs in CI on pushes, pull requests and weekly, and locally with `pnpm deps:check`. The
  accepted advisories and their reasons are in `deny.toml`. `async-executor` moved from the
  yanked 1.14.0 to 1.14.1.
- Documentation: project brief, getting started, architecture, feature pages, user guide,
  ADRs 0001–0007 and 0015, development guides.

### Fixed

- The Settings button and other tab changes did nothing until the page reloaded, after a hot
  reload while a development build started: the tab dock now reconnects whenever React runs its
  effects again (M9 slice 1).
- Commit module: after staging files with Space, the arrows scrolled the list instead of
  moving to the next file once the row last clicked was gone; lists now keep the keyboard when
  the focused row or button goes away, and Space no longer scrolls while a change is running.
- Dialogs: a long branch name or git message could stick out of the dialog (Create a branch),
  and a tall dialog out of the window; they now wrap and scroll inside.
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
- Reported by the owner (2026-11-09): the Repositories module showed two scrollbars. Labels for
  screen readers in its rows were laid out against the dock's pane instead of the module, so
  the pane scrolled too. Panels now contain everything inside them, and the dock's panes never
  scroll.
