# Troubleshooting

## Build

**"Access is denied (os error 5)" when cargo runs a build script (Windows).** Windows Defender
or Smart App Control blocks freshly built, unsigned executables. Add an exclusion for the
repository folder (it holds `target/`).

**`cargo install` fails with "Access is denied", or the installed tool will not start
(Windows).** Same cause: `cargo install` builds in `%TEMP%` and installs into `~/.cargo/bin`,
both outside the exclusion. Build and install inside the repository instead, for example
`cargo install cargo-deny --locked --root target/tools --target-dir target/cargo-install`,
then run `target/tools/bin/cargo-deny.exe check` (or put that folder on `PATH`), or add an
exclusion for `~/.cargo/bin`.

**`cargo test` exits with `STATUS_ENTRYPOINT_NOT_FOUND` (Windows).** The Common-Controls
manifest is missing. `src-tauri/build.rs` embeds `windows-app-manifest.xml` through linker
arguments for every artifact; check that this code is still there.

**`frontendDist` / `../dist` does not exist.** `tauri::generate_context!` needs `dist/` at
compile time. Run `pnpm exec vite build` once, or `mkdir dist`.

**Linux: `webkit2gtk-4.1` not found.** Install the system packages from
[getting-started.md](../getting-started.md).

**`pnpm install` warns about an unmet `eslint` peer of `eslint-plugin-jsx-a11y`.** Known and
harmless: the plugin has not declared ESLint 10 support yet.

## Running

**A new command returns "not allowed".** It is missing from `APP_COMMANDS` in
`src-tauri/build.rs` or from a capability in `src-tauri/capabilities/`.

**The status bar says "Git not available".** Hover it for the reason. Install git or set
`NOBLAME_GIT` to a git executable, then click the status entry to check again.

**`noblame --help` prints nothing on Windows.** Release builds attach to the terminal that
started them; output may appear after the prompt. Press Enter. In `cmd.exe` and PowerShell this
works; some terminals that are not real consoles show nothing.

**A second `noblame` launch does nothing.** The running instance received the arguments; look
for "second launch forwarded its arguments" in its log (`RUST_LOG=noblame_lib=debug`).

## Tests

**The cancellation test takes a few seconds on Windows.** The orphaned `sleep` started through a
git alias keeps the output pipe open until it exits, and the test runtime waits for the pipe
reader. Expected; see [background-jobs.md](../architecture/background-jobs.md).

**`pnpm bindings` changed `bindings.ts`.** Commit the regenerated file; CI fails when it is out
of date.

**`pnpm e2e` on Windows fails with "DevToolsActivePort file doesn't exist".** The terminal runs
as administrator: WebView2 150 and later then ignores the debugging port the Edge WebDriver asks
for. Run it from a normal terminal (CI sets a machine policy instead; ADR 0016).

## CI

What CI taught us (November 2026); releases have their own list in [release.md](release.md).

**Clippy fails on CI but not locally.** CI installs the Rust version in `rust-toolchain.toml`;
a newer Rust brings new lints. Raise the pinned version on purpose and fix them together.

**A test passes locally but fails on CI's git.** The runners have no git identity: tests that
commit or merge go through the fixture (`tests/support`), which sets one (`try_git` when the
command is expected to fail, as a merge with conflicts).

**Windows end to end: "DevToolsActivePort file doesn't exist".** See Tests above: everything on
GitHub's Windows runners runs as administrator, and the job sets the WebView2 machine policy.
When it fails, the step "The app on its own" starts the app alone and prints WebView2's command
line, the port file and the policies. GitHub's Windows machines differ: a re-run can pass where
the first attempt failed, so read a single green run with care.

**Linux end to end: the wrong window.** WebDriver lists window handles in no fixed order; tests
switch to the handle that was not there before (`switchToNewWindow`).

**Unpacking a download on a Windows runner.** PowerShell's `Expand-Archive` broke there; the
scripts use Windows' own `tar.exe` by its full path (Git's GNU `tar` on `PATH` cannot open zip
files).

**Linux: the watcher reports changes nobody made.** inotify reports files being opened and read;
the watcher drops reads (`watch/debounce.rs`), or its own ignore check reading `.git/index`
comes back as a change.

**A new push cancels the running CI.** `cancel-in-progress` in `ci.yml`: wait for a run to finish
before pushing again when you need its result.

## Logs

Set `RUST_LOG` (for example `RUST_LOG=noblame_lib=debug,git_core=debug`) before starting the app.
`git_core=debug` logs every git command line and working directory.
