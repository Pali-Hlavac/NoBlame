# 0001: Tauri 2 as the desktop shell

- Status: Accepted
- Date: 2026-10-27
- Milestone: M1

## Context and problem

NoBlame is a desktop Git client for Windows, Linux and macOS. Its users work on giant
repositories, so the shell must not add memory or startup cost on top of the work the Git engine
already does. We want one UI codebase for all three platforms, a backend language that can read
repositories fast and safely, and a way to open several small task windows (`noblame commit
<path>`) without starting a new heavy process each time.

## Decision drivers

- Performance and memory on large repositories; the shell must stay out of the way.
- One UI codebase for three platforms.
- A backend in a language with a mature, fast Git library (`gix`) and good process control.
- Small installers and fast startup, because task windows are opened from file-manager menus.
- A security model that limits what the UI can do.

## Considered options

1. Tauri 2 (Rust backend, system webview)
2. Electron (Node.js backend, bundled Chromium)
3. Qt (C++ or Rust bindings, native widgets or QML)
4. Native UI per platform (WinUI, AppKit, GTK)

## Decision outcome

Chosen option: **Tauri 2**, because it gives us a Rust backend (where `gix` lives), a web UI we
can build once, small binaries and a capability-based permission model for the webview.

Implementation in M1:

- `src-tauri/` is the Tauri crate (`noblame`, library `noblame_lib`), part of the Cargo
  workspace in the root `Cargo.toml`.
- `src-tauri/tauri.conf.json` sets a strict CSP and `freezePrototype`, and declares no windows;
  every window is created from Rust (ADR 0015).
- `src-tauri/build.rs` lists every app command so Tauri generates one ACL permission each, and
  embeds the Windows Common-Controls manifest so `cargo test` binaries start on Windows.
- Plugins: `tauri-plugin-single-instance` (argument forwarding) and `tauri-plugin-dialog`
  (folder picker).

### Consequences

Good:

- The Git engine and the app share one language and one process; no Node.js runtime.
- Release binaries are small and start quickly, which matters for task windows.
- The capability files in `src-tauri/capabilities/` decide which commands each window may call.

Bad:

- Three different webviews (WebView2, WKWebView, WebKitGTK) render and behave slightly
  differently. We must test the UI on all three; E2E tests run on Linux and Windows only.
- Linux development needs `libwebkit2gtk-4.1-dev` and related packages.
- Some ecosystem crates (tauri-specta) are pre-releases and must be pinned (ADR 0003).
- Creating a window inside a synchronous command deadlocks on Windows; such commands must be
  `async` (ADR 0015).

## Pros and cons of the options

### Electron

- Good: one rendering engine everywhere; huge ecosystem.
- Bad: bundles Chromium and Node.js, so memory and installer size are much higher. Git reads
  would run in Node.js or a separate native module, away from the UI process model we want.

### Qt

- Good: native-feeling widgets, mature, fast.
- Bad: C++ (or immature Rust bindings), licence considerations, and a smaller pool of UI
  components for the rich views we need (virtualized lists, diff viewer, palette).

### Native UI per platform

- Good: best platform integration.
- Bad: three UI codebases for a small team; feature parity would suffer.

## Links

- [ADR 0002](0002-rust-owns-git-access.md), [ADR 0003](0003-tauri-specta-typed-ipc.md),
  [ADR 0015](0015-cli-single-instance-task-windows.md)
- [../architecture/overview.md](../architecture/overview.md)
