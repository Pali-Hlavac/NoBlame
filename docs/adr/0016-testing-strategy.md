# 0016: Testing strategy

- Status: Accepted
- Date: 2026-11-17
- Milestone: M9

## Context and problem

NoBlame is tested in layers that grew with the milestones: Rust integration tests against the
real `git` (`crates/git-core/tests/`, a fixture builder), Rust unit tests in `src-tauri`,
frontend component tests in Vitest and jsdom with the IPC bindings mocked, benchmarks for the
graph, and a manual checklist (`docs/development/manual-checklist.md`) for what only a person in
the running app can judge. Until M9 nothing exercised the whole chain at once: the real webview
calling real commands on a real repository. Each milestone was checked by hand in a dev
instance, which cannot run in CI and is easy to skip when the owner's app is running.

The question: how do the layers divide the work, and how is the whole app tested end to end
without touching the developer's own settings or running app?

## Decision drivers

- Fast, deterministic tests where the logic lives (git-core, `lib/` functions, components).
- A few end-to-end paths through the real app that catch wiring mistakes (capabilities,
  commands not registered, events, windows) on Windows and Linux in CI.
- E2E must never touch the user's settings, layout or recent list, nor forward to a NoBlame
  they have open (single instance).
- Few dependencies; nothing that ships to users.
- Accessibility checked automatically, not only by review.

## Considered options

1. WebdriverIO with its test runner and `tauri-driver`
2. A small WebDriver client over `fetch`, Vitest as the runner, and `tauri-driver`
3. Playwright against the dev server in a browser, with the IPC mocked

## Decision outcome

Chosen option: **2**, with these layers:

| Layer               | Where                                        | What it proves                                                           |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| git engine          | `crates/git-core/tests/` (`pnpm test:rust`)  | Reads and writes against the real `git`, edge cases of repository shapes |
| Tauri side          | `src-tauri` unit tests                       | Services, DTOs, settings files, the CLI and its help                     |
| Components          | `src/**/*.test.tsx` (`pnpm test`)            | What users see and do, by roles and labels; IPC mocked                   |
| Accessibility       | `pnpm test:a11y`, `src/app/contrast.test.ts` | axe-core on every component test's screen; WCAG contrast of the tokens   |
| End to end          | `e2e/` (`pnpm e2e`)                          | The real app on a real repository: open, browse, commit, branch, merge   |
| Performance         | `pnpm bench`, the spikes                     | Graph and status on giant repositories                                   |
| What needs a person | the manual checklist                         | Looks, drag and drop, platform dialogs                                   |

End to end:

- `scripts/e2e.mjs` builds tauri-driver 2.1.0 into `.cache/e2e/tools` (inside the repository:
  Windows Defender blocks build scripts run from the temp folder), downloads the Microsoft Edge
  WebDriver matching the installed WebView2 on Windows (Linux uses `WebKitWebDriver` from
  webkit2gtk-driver), builds the app as a debug build with the frontend built in into
  `target/e2e` (so the dev build is not replaced), and runs `e2e/*.e2e.ts` with Vitest
  (`e2e/vitest.config.ts`, one file at a time).
- `e2e/support/webdriver.ts` speaks W3C WebDriver directly: start a session with
  `tauri:options`, run scripts in the page, type and press keys. Checks read the page with
  scripts (accessible names, row text) and the repository with `git`, not pixels.
- The app runs with `NOBLAME_PROFILE_DIR` (`src-tauri/src/storage/profile.rs`): its settings,
  layout, recent list, graph cache and webview storage live in a temporary folder, and the
  single-instance plugin is left out, so it neither forwards to nor receives launches from the
  user's NoBlame.
- The smoke test (`e2e/smoke.e2e.ts`) opens a fixture repository from the Welcome tab's recent
  list (the fixture writes the profile's `recent-repositories.json`) and waits for its history,
  stages and commits with Ctrl+Enter, creates a branch with Ctrl+Shift+N, then starts the app
  again, opens the Merge window with `open_task_window` (as the palette does) and merges a
  branch there. About four seconds once built.
- The app is started without arguments: the Edge WebDriver passes `args` on as browser
  switches (`--c:\users\...\repo`, lowercased), which the command line refuses
  (exit code 2). The driver names the webview's folder and debugging port in
  `WEBVIEW2_USER_DATA_FOLDER` and `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`. WebView2 150 and later
  ignores both in an app run as administrator, as everything is on GitHub's Windows runners
  ("DevToolsActivePort file doesn't exist"; MicrosoftEdge/WebView2Feedback#5640, by design). The
  app passes the folder to the webview itself (`storage::profile`); CI sets the machine policy
  `HKLM\SOFTWARE\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments`, value
  `noblame.exe` = `--remote-debugging-port=0`, on the throwaway runner. Passing the port from the
  app did not reach the webview there. Run locally as a normal user, nothing extra is needed.
- macOS is not covered: WKWebView has no WebDriver (the roadmap's decision).

### Consequences

Good:

- One command runs the whole chain locally and in CI; a missing capability or an unregistered
  command fails a test instead of a manual check.
- No new runtime dependency and only small dev ones (axe-core; tauri-driver and the Edge
  WebDriver are tools fetched by the script, not packages).
- The developer's NoBlame and settings are safe while tests run.

Bad:

- The first run builds tauri-driver and a separate debug build (minutes); later runs reuse
  them (`pnpm e2e --no-build` skips the app build).
- The Edge WebDriver must match WebView2 exactly; a WebView2 update downloads a new one.
- The client is ours to maintain (about a hundred lines).

## Pros and cons of the options

### Option 1: WebdriverIO

- Good: the documented Tauri setup, rich waiting and selector helpers, reporters.
- Bad: dozens of packages (`@wdio/cli`, local runner, framework, reporter) for a handful of
  commands; a second test runner beside Vitest.

### Option 2: our WebDriver client, Vitest, tauri-driver

- Good: tiny, the runner the project already uses, the same `waitFor` and assertions style.
- Bad: we write the few helpers WebdriverIO would give.

### Option 3: Playwright on the dev server

- Good: fast, great tooling.
- Bad: not the real app: the IPC would be mocked, so the wiring it should catch is not tested.

## Links

- [docs/development/testing.md](../development/testing.md)
- [docs/development/manual-checklist.md](../development/manual-checklist.md)
- Tauri WebDriver guide: <https://v2.tauri.app/develop/tests/webdriver/>
- ADR [0015](0015-cli-single-instance-task-windows.md) (single instance, task windows)
