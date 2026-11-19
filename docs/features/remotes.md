# Remotes: fetch, pull, push, managing remotes and clone

Status: **M5 slice 3 done (2026-11-06)**: Fetch, Fetch all remotes and Fetch and prune as
background jobs, with a jobs list in the status bar; **slice 4 (2026-11-06)**: asking for
user names, passwords, SSH passphrases and unknown host keys in the app; **slice 5
(2026-11-06)**: pull (as configured, merge, rebase, fast-forward only) and push (the current
branch, any branch with options and force with lease, tags, deleting on a remote); **slice 8
(2026-11-07)**: managing remotes (add, edit, remove), clone as a job, and Fetch all remotes as
one fetch per remote, so it shows progress; **M10 slice 1 (2026-11-19)**: the remote editor
(General and Advanced tabs, review and save all or nothing); **slice 2**: Fetch and Push tabs,
search; **slice 3**: Branches tab, the original of a fork; **slice 4**: Test connection, the
server's default branch, HTTPS ⇄ SSH, Open in browser, passwords and old-server settings moved;
**slice 5**: Connection tab, SSH key per remote; **slice 6**: Credentials and LFS tabs;
**slice 7**: the brief's integration tests, checks in the app, ADR 0024 accepted. The job model is
[architecture/background-jobs.md](../architecture/background-jobs.md) (ADR 0011).

## Where

| Place                                                                   | Entries                                                                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Toolbar: **Pull** and its ▾ menu                                        | Pull, Pull (merge), Pull (rebase), Pull (fast-forward only), Fetch, Fetch all remotes, Fetch and prune, Remotes… |
| Toolbar: **Push** and its ▾ menu                                        | Push (the current branch), Push… (the dialog)                                                                    |
| Command palette, group "Remote"                                         | The same, while a repository is active (pull and push only on a branch)                                          |
| Branches module and the graph's branch menus                            | Local branch: Push…; remote branch: Delete on the remote…; tag: Push…, Delete on a remote…                       |
| Repositories module: a repository's **…** menu                          | Pull, Fetch, Push (open or closed repositories); also quick buttons, by setting                                  |
| Repositories module: a group's menu                                     | Pull all, Push all (one job per repository); also quick buttons, by setting                                      |
| Branches module: the cloud button; palette **Manage remotes…**          | The Remotes dialog (add, edit, remove, fetch a remote)                                                           |
| Welcome tab, Repositories module toolbar, palette **Clone repository…** | The Clone dialog                                                                                                 |

## Behaviour

- **Fetch** runs `git fetch --progress`: git picks the current branch's remote, else
  `origin`. **Fetch and prune** adds `--prune` (remote branches deleted on the remote go too).
- **Fetch all remotes** is one job running `git fetch --progress <remote>` for each remote in
  turn, the later ones with `--append` (so `FETCH_HEAD` keeps them all, as `git fetch --all`
  does); remotes with `remote.<name>.skipFetchAll` or `skipDefaultUpdate` are left out
  (`fetch_all_remotes`). Unlike `--all`, each fetch shows its progress. Its command reads `git
fetch --progress a; git fetch --progress --append b`; its log has a `$ <command>` line before
  each. A remote that fails does not stop the next one (the job fails); Cancel stops all.
- Each fetch is a job: it starts at once and the UI stays usable. A toast appears the moment it
  is chosen ("Fetching…", before git runs), then shows the job's title, git's phase with a small
  progress bar and **Cancel**; when the job ends the same toast says how
  (`src/features/jobs/lib/toasts.tsx`). A thin strip along the top of the status bar, across
  the window, moves while any job runs (it fills up while one job reports a percent). The status bar shows
  "Fetch: Receiving objects 45%" while it runs (with "+1" when more run); clicking it lists
  running and recent jobs: a progress bar with git's phase, size and speed, the time taken,
  **Cancel**, **Copy command** and **Log** (git's output, the command line first).
- When it ends, a toast says what changed: "Fetch: 2 new, 1 updated, 1 pruned", "Already up to
  date", or "Fetch failed" with git's `fatal:` lines and **Show log**. Cancelled jobs say so.
- **Cancel** kills git and everything it started (`git-remote-https`, `ssh`), so nothing goes on
  talking to the server.
- The repository is checked like when opening it (an untrusted one is refused, with the
  `safe.directory` hint). It need not be open: the Repositories module fetches closed ones.
- An open repository's graph, branches and upstream counts reload when the fetch moves remote
  branches (the file watcher sees the refs change).
- Credentials: see below.

## Pull

- **Pull** runs `git pull --progress --no-edit` in the work tree: the current branch from its
  upstream, joined as the user's config says (`pull.rebase`, `pull.ff`). The menu forces a way:
  **Merge** (`--no-rebase`), **Rebase** (`--rebase`), **Fast-forward only** (`--ff-only`).
  `--no-edit` keeps git from opening an editor for the merge message.
- The toast says what happened: "Fast-forwarded: 1 file changed, 1 insertion(+)", "Merged: …",
  "Rebased", "Already up to date".
- Refusals get a next step in plain words, before git's own lines (`pull_hint`): both sides
  have new commits and no `pull.rebase` set (choose Merge or Rebase), not a fast-forward,
  conflicts (resolve, then commit or `git rebase --continue` in a terminal; conflict tools are
  M6), no upstream (Set upstream…), local changes in the way (commit or stash), detached HEAD.
- Pull needs a branch: on a detached HEAD the Pull and Push buttons are disabled.

## Push

- **Push** (the button) pushes the current branch to its upstream when that is a remote branch:
  `git push --progress --porcelain <remote> refs/heads/<branch>:refs/heads/<upstream branch>`.
  Without an upstream (or with a local one) it opens the Push dialog instead.
- **The Push dialog** (Push…, and Push… on any local branch): the remote (its upstream's, else
  `origin`, else the first), the branch name there (its upstream's, else the same name), **Make
  it the upstream** (on when it has none: `--set-upstream`), **Also push annotated tags on these
  commits** (`--follow-tags`), and **Force: replace the branch there**.
- **Force** names what would be lost before the button (red, "Force push") is pressed: the
  commits on the remote branch, as the last fetch saw it, that the local branch lacks
  (`get_missing_commits`: `git rev-list --count <remote branch> --not <local branch>`, the newest
  three listed). The push runs with `--force-with-lease=refs/heads/<name>:<the commit shown>`: if
  someone pushed since, git refuses and nothing is lost ("The remote branch moved since your last
  fetch…"). A branch that did not exist there must still not exist (an empty lease).
- **Tags**: Push… on a tag pushes `refs/tags/<name>`; with several remotes the dialog asks which.
- **Deleting on a remote**: a remote branch's **Delete on the remote…** names the commits only
  it holds (as Delete does for local branches) and runs `git push <remote> --delete
refs/heads/<name>`; the remote-tracking branch goes too. A tag's **Delete on a remote…** asks
  which remote; the local tag stays.
- The result, from `--porcelain`: "1 new", "2 updated", "1 replaced", "1 deleted", "Everything
  up to date". Refusals get a hint (`push_hint`): the remote has commits you don't (pull
  first), the lease failed, the server refused (protected branch, hook), unknown remote,
  nothing to push under that name.
- Names from the UI are checked as branch or tag names before they go into a refspec, which is
  always built from full names (`refs/heads/a:refs/heads/b`), so it can never read as an option
  or a force marker (`+`).

## Credentials

([ADR 0012](../adr/0012-credentials-and-askpass.md), [security](../architecture/security.md#credentials))

- git's credential helpers (Git Credential Manager, keychain, libsecret, `store`) and ssh
  agents answer first, as in a terminal. NoBlame changes no config.
- When nothing answers, git or ssh asks NoBlame (askpass). The main window shows a dialog
  naming the job and the repository, with git's or ssh's own question:
  - **User name** (shown as typed), **Password or token**, **Passphrase** (hidden), or an
    answer for anything else (hidden);
  - an **unknown server**: the fingerprint ssh printed, **Trust and connect** (`yes`) or
    **Don't connect** (`no`; also on Escape).
- **Cancel** or Escape: git fails with its own message ("could not read Username"). A prompt
  nobody answers is given up after 10 minutes; one whose job ends (cancelled) closes.
- Several prompts wait in order; the taskbar button flashes when the app is in the background.
- The answer goes to git only; git gives it to the credential helper when the fetch succeeds,
  so the next one does not ask. Credentials written into URLs are shown as `***` in logs and
  messages.
- Needs OpenSSH 8.4 or later for ssh prompts (`SSH_ASKPASS_REQUIRE=force`).

## Managing remotes: the remote editor

M5 slice 8, rebuilt as the remote editor in M10 (slice 1, 2026-11-19; ADR
[0024](../adr/0024-remote-configuration-editing.md)). The **Remotes** dialog of the active
repository (toolbar **Pull ▾ → Remotes…**, palette **Manage remotes…**, the cloud button in the
Branches module, **Add a remote…** in the Push dialog of a repository without one) lists the
remotes on the left (name, URL with any password as `***`, remote branches, the branches tracking
it, a **Fetch** button) and shows the chosen one's settings on the right, in tabs. **Add
remote…** below the list shows the form to add one.

- **Add remote**: name (`origin` when free) and URL: `git remote add -- <name> <url>`. **Fetch
  its branches now** (on) then starts a fetch of it; the new remote opens in the editor.
- **General** tab: **Name** (renaming moves its remote branches; the branches tracking it
  follow), **URL** (the first `remote.<name>.url`; more URLs are counted and edited in Advanced),
  **Push URLs** (any number; with several, each push goes to all of them), **Default branch**
  (`refs/remotes/<name>/HEAD`, chosen among its remote branches here, or not set), **When the
  server's default branch changes** (`remote.<name>.followRemoteHEAD`; git 2.48 or later, else
  disabled with the version needed; a value set by the user's settings is shown under it), and
  **Remove <name>…** (a confirmation names what goes from this repository: its remote branches,
  and the local branches that lose their upstream; then `git remote remove -- <name>`).
- **Talking to the remote** (slice 4), under the URL in General:
  - **Test connection**: `git ls-remote --heads -- <name>` as a job (`test_remote_connection`,
    kind `testConnection`; askpass asks for credentials as for a fetch). The toast says
    "Connected: 12 branches on the server" or, on failure, a next step first (`connection_hint`:
    unknown or changed SSH host key, SSH key refused, certificate not trusted, proxy, credentials
    refused, name not found, server not reached, no repository there). It uses the saved URL;
    with the URL changed, the tab says so.
  - **Use SSH** / **Use HTTPS**: the same repository over the other protocol, for GitHub, GitLab,
    Bitbucket and Azure DevOps (`dev.azure.com` and `*.visualstudio.com`; `lib/settings/hosts.ts`);
    it changes the draft's URL, nothing else.
  - **Open in browser**: the repository's web page (those hosts, and any `https://` remote without
    its user name or password), opened by `open_web_page`, which opens only `http(s)://`
    addresses without credentials.
  - **Ask the server** (next to Default branch): `git remote set-head --auto -- <name>` as a job
    (`ask_remote_default_branch`, kind `setHead`); disabled while there are unsaved changes.
  - **A password written into a URL** (`url` or `pushurl` of this repository): a notice offers
    **Move it to the credential helper** (`move_remote_passwords`): each password goes to `git
credential approve` (on stdin; the window never sees it), then the URLs are saved with the
    user name only, through the plan. Refused when no credential helper is set up ("git would
    forget the password"); disabled while there are unsaved changes.
  - **Settings of the old server**: when the draft moves the URL to another server (scheme, host
    or port), this repository's `http.<url>.*` and `credential.<url>.*` keyed by the old server
    are listed with **Move them to the new server** (removed under the old key, written under the
    new, in the same save; `lib/settings/urlKeyed.ts`). The user's own ones are left alone.
- **Connection** tab (slice 5):
  - **HTTP(S), for <server>** (only when the URL is an http(s) address): settings keyed by the
    remote's server, `http.<server>/.<name>` (an existing key written without the `/` is edited
    in place): **Proxy** (`remote.<name>.proxy`: as git decides, naming `http.proxy`; **No proxy
    for this remote**, an empty value; or an address), **Proxy sign-in** (`proxyAuthMethod`),
    **Verify the server's certificate** (`sslVerify`; "No" warns), **Certificate authority
    file** (`sslCAInfo`, Browse…), **Certificates come from** (`http.sslBackend`, Windows only:
    the Windows certificate store or OpenSSL), **Client certificate** and its key (`sslCert`,
    `sslKey`), **Extra HTTP headers** (`extraHeader`, several; shown as `Authorization: ***`,
    kept when unchanged; plain text in `.git/config`, the help says so), **HTTP version**,
    **Push buffer size** (`postBuffer`) and the slow-connection limits (`lowSpeedLimit`,
    `lowSpeedTime`).
  - **SSH key**: NoBlame's own setting (git has none per remote), kept in
    `remote-ssh-keys.json` in the config folder by repository folder and remote
    (`src-tauri/src/ssh_keys.rs`), not in the settings file, so a window holding an older copy of
    the settings cannot overwrite it. Fetch (each remote of Fetch all), Pull, Push, Test
    connection and Ask the server then run git with `GIT_SSH_COMMAND="<ssh> -i "<key>" -o
IdentitiesOnly=yes"`, where `<ssh>` is the environment's `GIT_SSH_COMMAND`, else
    `core.sshCommand`, else `ssh` (`jobs/ssh.rs`; when git picks the remote, it is the current
    branch's, else `origin`). A terminal does not see it; the help points to `~/.ssh/config`. It
    is saved first (`set_remote_ssh_key`: refuses a `.pub` file and a path with no file), so a
    bad path stops the save before git's settings change; a rename moves it, removing the remote
    forgets it. The review lists it as "NoBlame's own setting".
  - **Rarely needed**: `uploadpack`, `receivepack`, `serverOption` (several; git 2.48+).
- **Credentials** tab (slice 6; for an http(s) URL, else it says SSH signs in with the key):
  - **Helpers git asks** (read-only): every `credential.helper` and `credential.<url>.helper`
    whose URL matches the remote's (scheme, host with `*` labels, port, path prefix, user; a
    partial `host/path` too), in the order git reads the files, the draft standing for this
    repository's; an empty value drops the ones before it (said so). Each is named (Git Credential
    Manager, `store` with a red "not encrypted", `cache`, `wincred`, `osxkeychain`, libsecret, a
    program of its own) with where it is set. None: a red line says git asks every time and keeps
    nothing (`lib/settings/credentials.ts`).
  - **Sign-in**: **Sign in** runs Test connection (the helper asks when nothing is saved and
    keeps the answer); **Forget the saved sign-in…** asks, then `forget_remote_credentials`:
    `git credential reject` with `url=<address>` on stdin (git splits it and applies
    `useHttpPath`), once per http(s) address of the remote (URL and push URLs, passwords
    dropped). Other repositories on the server share it, the confirmation says so.
  - Settings keyed by the server, `credential.<server>.<name>` (the form GCM documents and reads
    too): **Helpers for this server** (`helper`, several), **User name**, **A separate sign-in
    per repository** (`useHttpPath`), and with GCM among the helpers **Kind of server**
    (`provider`).
  - **Azure DevOps, organization <org>** (for `dev.azure.com/<org>/…` and
    `<org>.visualstudio.com`; red when GCM is not among the helpers): **Account for this
    organization** (`credential.azrepos:org/<org>.username`, what `git credential-manager
azure-repos bind --local` writes; GCM's `list` and `unbind` are not run), **Sign in to Azure
    DevOps with** (`azreposCredentialType`: OAuth or PAT), **Sign in through Windows**
    (`msauthUseBroker`, Windows only), **Where the Microsoft sign-in shows** (`msauthFlow`), each
    keyed by the server.
- **LFS** tab (slice 6; shown when the repository uses LFS: `<common dir>/lfs` exists or the top
  `.gitattributes` has `filter=lfs` (`git_core::lfs::uses_lfs`, `RemoteSettingsDto.usesLfs`), or
  the remote sets `lfsurl`): **LFS server** (`remote.<name>.lfsurl`; the placeholder is the one
  git-lfs works out: `<url>.git/info/lfs`, https for SSH addresses), **LFS server for pushing**
  (`lfspushurl`), **Check locks before pushing** (`lfs.<lfs server>.locksverify`, keyed by the
  saved server; while a new one is typed it says to save first).
- **Settings that apply**: a registry entry may carry `applies` (`lib/settings/conditions.ts`:
  http(s) URL, Azure DevOps, GCM in use, Windows, an LFS server), and the tabs and the search use
  the same conditions, so the search only counts what is on screen.
- **Fetch** tab (slice 2): **What to fetch**: **Every branch** (`+refs/heads/*:refs/remotes/<name>/*`)
  or **Only these branches** (names or patterns with one `*`, such as `release/*`; one refspec
  each, `+refs/heads/<b>:refs/remotes/<name>/<b>`; at first the default branch); refspecs written
  by hand show as "Something else" and are changed in Advanced. **Tags** (`tagOpt`: the tags on
  the commits fetched, every tag, none). **Remove remote branches deleted on the server**
  (`prune`) and **Remove tags that are not on the server** (`pruneTags`, with a warning that tags
  made here and not pushed go), each "as `fetch.prune` / `fetch.pruneTags` says (now: yes)" when
  not set here. **Leave out of Fetch all** sets `skipFetchAll` and `skipDefaultUpdate` together.
  A partial clone's filter is shown (read-only). **Fetch now** and **Fetch and remove deleted
  branches now** start a fetch job with the saved settings.
- **Push** tab (slice 2): **Push here by default** (`remote.pushDefault`, the repository's; the
  remote set now is named), **What a plain push sends** (`remote.<name>.push`, listed; changed in
  Advanced), **Mirror this repository** (`mirror`; turning it on asks first and names what a
  mirror push deletes and overwrites), and the repository's own push settings, under "For every
  remote of this repository": `push.followTags`, `push.autoSetupRemote`,
  `push.recurseSubmodules`, `push.gpgSign`.
- **Branches** tab (slice 3): the local branches whose upstream is on this remote
  (`branch.<b>.remote` = the remote), each with its **Upstream** (one of the remote's branches
  here, written as `branch.<b>.merge = refs/heads/<x>` like `git branch --set-upstream-to`, or
  **Stop tracking**: both keys removed; the branch stays listed until the dialog closes, so it can
  be set back), **Push to** (`branch.<b>.pushRemote`; "as the repository says" names
  `remote.pushDefault` or the remote) and **Pull by** (`branch.<b>.rebase`: merge, rebase,
  rebase keeping merges). **Make <branch> track <remote>/<branch>** sets the upstream of a local
  branch that does not track it yet. "Pulling, for every branch of this repository": `pull.rebase`
  and `pull.ff`. The local branches come with the settings (`localBranches`, read with gix).
- **The original of a fork** (slice 3): in **Add remote**, next to an `origin`, "Forked a
  project? Add the original as upstream" fills in the name `upstream`; with that name and an
  `origin`, **Keep pushing to origin** (on) sets `remote.pushDefault = origin` after adding
  (`set_git_config`, this repository), so pulls come from the original and pushes go to the fork.
  Branches can then track `upstream` in its Branches tab once it is fetched.
- **Search** (slice 2): the box above the tabs (**Ctrl+F**, the Find commits key, while the editor
  is open; it does not reach the graph behind) finds settings by label, help, git key, synonyms
  ("refspec", "certificate", "mirror") and tab, and Advanced keys by key and value; case and
  accents are ignored (`normalize` of the Settings tab). Each tab shows its number of matches,
  tabs without any are dimmed, and the first tab with a match opens when the open one has none.
  Matching settings are outlined; **Enter** / **Shift+Enter** go to the next / previous match,
  across tabs, outlined more strongly and scrolled into view ("2 of 5"); **Esc** clears the
  search (a second Esc closes the dialog). Everything it searches is listed once in
  `lib/settings/registry.ts` (label, help, key, synonyms, tab), so a new setting is found at once.
- **Advanced** tab: every `remote.<name>.*` key, each with this repository's values (several per
  key, in order, each editable or removable; **Set in this repository** / **Add a value**) and
  the values from the user's or the system's settings, read-only with their file. **Add a
  setting** takes a name (letters, digits, `-`) and a value. **Address rewrites**
  (`url.<base>.insteadOf` / `pushInsteadOf`) are listed with their file, marked when they apply
  to the remote's URLs; they are changed in Settings → Git settings.
- **Nothing is written while editing.** The footer counts the changes; **Discard** drops them;
  **Review and save…** asks the backend for the commands (`preview_remote_changes`) and lists
  them (`git config --local --add remote.origin.pushurl …`, `git remote set-head origin main`,
  `git remote rename origin github`). **Save** runs them (`apply_remote_changes`) under the
  session's write lock: the keys, then the default branch, then the name. When one fails, the
  ones before are undone and the message says so ("Nothing was changed: the settings already
  saved were put back."). Choosing another remote, adding one or closing the dialog with unsaved
  changes asks first (**Discard changes**).
- **Checked first**: names as git checks them (and not one another remote has), URLs not empty
  and not starting with `-`, push URLs not empty. The backend refuses when the repository's
  values are not what the editor showed ("… changed since the editor read it"): another program
  changed them.
- **Passwords stay in the backend**: a password in a URL is shown as `ada:***@`, a header value
  (`http.extraHeader`) as `Authorization: ***`. A value saved as shown keeps its secret; a new
  value with `***` is refused (type the password again). The M5 edit form received URLs as
  configured; it is gone.
- Only the repository's own settings (`--local`) are written.
- The settings are read once when a remote is chosen (`get_remote_settings`: every scope with
  `--show-origin --show-scope`), not on focus, and afresh after saving or while nothing is
  changed when the refs change. The remotes list lives under the refs' key, so a change, a fetch
  or the watcher refreshes it, the Push dialog's remotes and the Branches module.

## Clone

M5 slice 8. **Clone repository…** (Welcome tab, the Repositories module's toolbar, the command
palette) opens the Clone dialog:

- **URL**, **Into** (the folder that will hold it: at first the folder of the newest recent
  repository; **Browse…**) and **Folder name** (from the URL, as git names it, until changed).
  "Clones into <path>" shows the result.
- **Options**: **Branch** (`--branch`; empty: the remote's default); **Download**: Everything,
  File contents when needed (`--filter=blob:none`) or Old commits' folders and files when needed
  (`--filter=tree:0`); **Only the newest commits: N** (`--depth`); **Only that branch**
  (`--single-branch`); **Submodules too** (`--recurse-submodules`, on); **Open it when done**
  (on).
- The folder is checked before git runs: a full path that does not exist (git creates it and
  any missing folders above it) or an empty folder. Otherwise the dialog stays open with the
  reason ("… already exists and is not empty").
- The clone is a job (`clone_repository`): `git clone --progress [options] -- <url> <folder>`,
  run in the nearest existing folder above it, with progress, the output window, Cancel and
  askpass like the others. On success the toast says "Cloned into <folder>" and the repository
  opens in a tab (`afterJob`, `src/features/jobs/lib/followUp.ts`, which also keeps a job's end
  that arrives before the reply that started it). Failures get a hint first (`clone_hint`): no
  repository at the URL, credentials or SSH key refused, unknown host, no such branch there,
  folder not empty.
- **Cancel** kills git's process tree, then removes what it wrote: the folder it made, or the
  contents of the empty folder it was given ("Cancelled: The partly cloned folder was
  removed."). After a failure git removes its own leftovers.
- Not offered: bare and mirror clones, another name than `origin` (`--origin`).

## Git output window

Owner request 2026-10-30, M5 slice 7. With **Settings → Fetch, pull and push → Show git's
output in a window while they run** (`jobs.showOutputWindow`, off by default), every job that
starts (toolbar, palette, menus, dialogs, Pull all) opens the **Git output** window: a console
at the top right, beside the work. It is not modal: the app stays usable, clicking elsewhere
does not close it, and it does not take the focus when it opens. Each job in the jobs list
also has **Output window**, which opens it on that job whatever the setting.

- It shows `$ <command>`, every line git printed (both streams, credentials in URLs hidden),
  the line git keeps rewriting (progress, dimmed) while it runs, and at the end "Done: 2 new",
  "Failed: <hint and git's reasons>" or "Cancelled". It follows new output while scrolled to
  the end; scrolled up, it stays put. It reads only the new lines (`get_job_output`).
- A job that starts while another in the window still runs joins it (Pull all lists every
  repository, the first stays on screen); a **Job** list chooses among them. Once they all
  ended, the next job starts the window afresh with only itself.
- **Fetch all remotes** shows each remote's progress since slice 8 (one fetch per remote):
  `git fetch --all` printed none when its output was not a terminal (git 2.56: 0 progress lines
  for two remotes, 408 for one).
- **Cancel** (while running), **Copy output**, and **×** or Escape to close it: the jobs go on
  in the background and their toasts still come.
- **Close when they succeed** (`jobs.closeOutputOnSuccess`, on by default; in the window and in
  Settings): once every job in it succeeded, it closes after 1.5 s. If one failed it stays, so
  the reason can be read. A finished job opened from the jobs list does not close it.

## Repositories module

M5 slice 6. The **…** menu of a repository and its quick buttons
([repositories.md](repositories.md#quick-buttons)) work without opening it:

- **Pull** pulls the current branch as configured (`pull_repository`, mode `default`), like the
  toolbar's Pull.
- **Push** sends the current branch to its upstream (`push_current_branch`): the backend reads
  `branch.<name>.remote` and `branch.<name>.merge` with gix (`upstream_push`) and runs the same
  explicit push as the toolbar (`refs/heads/a:refs/heads/b`). There is no dialog to ask where,
  so a detached HEAD or a branch without an upstream on a named remote (none, a local one, a
  URL) is refused before git runs, with the hint to use **Push…** in the toolbar.
- **Pull all** on a group pulls every repository of the group with **merge** (as the owner
  asked: a rebase stopped by conflicts in one of many repositories is harder to notice and
  finish), **Push all** pushes each one's current branch to its upstream. One job per
  repository, all started at once (`startBatch` in `src/features/jobs/lib/batch.ts`). Their
  jobs do not toast one by one: one toast appears at once and counts them ("2 of 7
  repositories done"); when the last one ends, it sums them up ("Pull all in
  Work: 3 done, 1 failed"), failures first with their first line (the hint, when there is
  one), at most six lines and "and N more", with **Show jobs**. A repository whose job could not
  start (missing folder, no upstream) counts as failed. Every job is in the jobs list with its
  own log.

## Code

- `crates/git-core/src/remote/`: `fetch.rs` (`fetch_command`, `summarize_fetch`),
  `progress.rs` (`parse_progress`). `crates/git-core/src/cli/stream.rs` and `tree.rs`. Tests:
  `tests/remote_fetch.rs`, `tests/cli_stream.rs`.
- `crates/git-core/src/remote/pull.rs` (`pull_command`, `describe_pull`, `pull_hint`), `push.rs`
  (`push_command`, `Lease`, `summarize_push`, `describe_push`, `push_hint`), `remotes.rs`;
  `branch/unique.rs` (`commits_not_in`). Tests: `tests/remote_push_pull.rs` (two clones of a
  bare repository: new branch with upstream, tag, delete, rejected push, fast-forward-only
  refusal, merge pull, force with lease refused and then allowed).
- `crates/git-core/src/remote/prompt.rs` (`classify_prompt`), `redact.rs`.
- `src-tauri/src/askpass/`: `client.rs` (the helper mode of `noblame`, checked first in
  `main`), `server.rs` (listener, pending prompts), `token.rs`, `protocol.rs`, `commands.rs`
  (`list_credential_requests`, `answer_credential`).
- `src/features/credentials/` (`CredentialPrompt`, mounted in the main window).
- `src-tauri/src/jobs/`: `registry.rs`, `fetch.rs` (opens the repository, builds the title and
  the result message), `commands.rs`, `types.rs` (`JobDto`, `JobUpdated`).
- `src-tauri/src/jobs/sync.rs` (`pull_repository`, `push_repository`, `push_current_branch`,
  `list_remotes`), `target.rs` (opening the repository of a job). `remote/remotes.rs`
  (`upstream_push`; test `finds_where_the_current_branch_pushes`).
- `crates/git-core/src/remote/manage.rs` (`remote_details`, `add_remote`, `rename_remote`,
  `remove_remote`, `set_remote_url`, `unset_push_url`), `settings.rs` (`plan_remote_edit`,
  `describe_remote_edit`, `apply_remote_edit`), `connection.rs` (`ls_remote_command`,
  `set_head_auto_command`, `connection_hint`), `credential.rs` (`split_password`,
  `store_password`, `forget_credentials`, `has_credential_helper`), `lfs.rs` (`uses_lfs`), `refs.rs` (`remote_head`, `remote_branch_names`,
  `local_branch_names`),
  `crates/git-core/src/config/` (`scoped.rs` every scope with its file, `plan.rs` the change
  plan, applying and undoing it, `secret.rs` hiding passwords and header values), `validate.rs`, `clone.rs`
  (`check_clone_target`, `clone_command`, `clone_hint`, `remove_partial_clone`), `fetch.rs`
  (`fetch_commands`, `fetch_all_remotes`). Tests: `tests/remote_manage.rs`, `tests/remote_clone.rs`,
  `tests/remote_settings.rs` (several keys and push URLs, default branch and rename at once,
  hidden password kept, stale values refused, undone when a write or the rename fails),
  `tests/remote_settings_fetch.rs` (only chosen branches and no tags fetched, pruning,
  `http.<url>.*` and `credential.<url>.*` moved with the URL and read by git for the new one).
- `src-tauri/src/jobs/remote_check.rs` (Test connection, Ask the server);
  `src-tauri/src/branches/remote_password.rs`, `remote_web.rs`; tests
  `crates/git-core/tests/remote_connection.rs` (ls-remote, set-head, a password stored and
  forgotten by a `store` helper set up in the fixture only, LFS detected).
- `src-tauri/src/branches/remotes.rs`, `remote_commands.rs`, `remote_types.rs`,
  `remote_settings.rs` and `remote_settings_types.rs` (the editor's commands);
  `src-tauri/src/jobs/clone.rs`, `steps.rs` (several commands in one job).
- `src/features/remotes/` (`RemotesDialog`, `RemoteList`, `RemoteForm` (adding),
  `RemoveRemoteDialog`, `CloneDialog`, `CloneOptions`, `lib/clone.ts`, `lib/remotes.ts`,
  `openRemotes`, `openClone`); the editor in `components/editor/` (`RemoteEditor`, `EditorTabs`,
  `GeneralTab`, `AdvancedTab`, `RewritesList`, `SettingRow`, `ValuesEditor`, `ReviewDialog`) and
  `lib/settings/` (`registry.ts` and `registryTransfer.ts` every setting with its tab, help, key
  and synonyms; `draft.ts` the unsaved changes; `problems.ts`; `rewrites.ts`; `refspecs.ts` what
  to fetch; `search.ts`; `choices.ts`), `api/remoteSettings.ts`; the Fetch and Push tabs
  (`FetchTab`, `PushTab`, `ChoiceSetting`), `UrlActions` and `UrlNotices` (slice 4), the
  Connection tab (`ConnectionTab`, `ProxySetting`, `TextSetting`, `SshKeySetting`,
  `lib/settings/registryConnection.ts`; test `editor/ConnectionTab.test.tsx`), the Credentials
  and LFS tabs (`CredentialsTab`, `HelpersInUse`, `CredentialActions`, `LfsTab`,
  `lib/settings/registryCredentials.ts`, `credentials.ts`, `conditions.ts`; tests
  `editor/CredentialsLfsTabs.test.tsx`, `lib/settings/credentials.test.ts`), the Branches tab (`BranchesTab`, `TrackBranch`,
  `lib/settings/tracking.ts`), the search (`EditorSearch`, `useEditorSearch`,
  `highlight.ts`); tests `RemotesDialog.test.tsx`, `editor/RemoteEditor.test.tsx`,
  `editor/FetchPushSearch.test.tsx`, `editor/BranchesTab.test.tsx`,
  `editor/ConnectionActions.test.tsx`, `lib/settings/hosts.test.ts`, `urlKeyed.test.ts`, `lib/settings/tracking.test.ts`, `lib/settings/draft.test.ts`, `refspecs.test.ts`,
  `search.test.ts`,
  `CloneDialog.test.tsx`, `lib/clone.test.ts`.
- `src/features/jobs/components/OutputWindow.tsx`, `OutputConsole.tsx`, `store/output.ts`,
  `lib/output.ts` (the output window); tests `OutputWindow.test.tsx`, `lib/output.test.ts`.
- `src/features/jobs/` (`startFetch`, `startPull`, `startPush`, `startPushCurrent`, `startJob`,
  `startBatch`, `useJobRunning`); `src/app/workbench/repositoryActions.ts` (`REPOSITORY_ACTIONS`,
  `GROUP_ACTIONS`); `src/features/repositories/components/QuickButtons.tsx`;
  `src/features/branches/components/PushDialog.tsx`, `ForceWarning.tsx`, `RemoteRefDialog.tsx`,
  `lib/pushCurrent.ts`, `lib/remotes.ts`, `api/remotes.ts`; `src/app/workbench/remote.ts` and
  `remoteCommands.ts` (toolbar, palette, "…" menu).

## Performance

Fetching is bound by the network and the server. The app's share: one line callback per line
of output and at most ten `JobUpdated` events per second per job. A clone of synthetic-10k
over the pack protocol printed 411 progress lines in about a second, which the throttle turns
into about ten updates.

Slice 8 (2026-11-07, Windows 11, git 2.56, debug build):

- Fetch all remotes into an empty repository from two local remotes (synthetic-100k, 772,382
  objects, and a copy of synthetic-10k): 2,342 log lines, progress shown for both, "2323 new".
- Renaming a remote with 2,025 remote branches (loose refs after a first fetch): about 5 s, all
  of it `git remote rename` rewriting each reference; the Save button says "Saving…" meanwhile.
- Listing remotes reads the config and walks `refs/remotes/` once (gix) for all of them.
