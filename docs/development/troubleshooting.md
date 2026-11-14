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

## Logs

Set `RUST_LOG` (for example `RUST_LOG=noblame_lib=debug,git_core=debug`) before starting the app.
`git_core=debug` logs every git command line and working directory.
