# 0005: Code organization (workspace, modules, feature folders)

- Status: Accepted
- Date: 2026-10-27
- Milestone: M1

## Context and problem

NoBlame will grow into a large application: a Git engine, a graph renderer, many feature views
and, in phase 2, shell add-ons. Contributors (people and AI agents) need to find code quickly,
change one feature without breaking another, and test the Git engine without starting a desktop
app. Large files hide bugs and make reviews slow.

## Decision drivers

- The Git engine must be testable and benchmarkable without Tauri.
- Each Tauri module and each UI feature should have the same predictable shape.
- Feature boundaries must be visible and enforceable.
- Files stay small enough to read in one sitting.

## Considered options

1. Cargo workspace with a Tauri-free engine crate; layered Tauri modules; UI feature folders
2. Single Tauri crate; UI organized by technical layer (`components/`, `hooks/`, `api/`)

## Decision outcome

Chosen option: **workspace + layered modules + feature folders**.

Rust, a Cargo workspace in the root `Cargo.toml`:

- `crates/git-core`: the Git engine. **Must never depend on Tauri.** In M1 it holds the git CLI
  runner (`src/cli/`); `repo/`, `graph/`, `diff/`, `blame/`, `status/` and `cache/` are added by
  later milestones. Integration tests in `crates/git-core/tests/` run against real repositories.
- `crates/repo-gen`: the synthetic repository generator (library and `noblame-repo-gen` binary),
  used by tests, benchmarks and `pnpm repos:generate`.
- `src-tauri`: the app. Each module is a folder with `mod.rs`, `commands.rs` (thin Tauri
  boundary), `service.rs` (logic), `error.rs` (thiserror enum and `From<…> for AppError`) and
  `types.rs` (IPC types), as needed. M1 modules: `app_info`, `settings`, `storage`, `git_env`,
  `cli`, `windows`.
- Workspace lints: `unsafe_code = "deny"` (one documented exception for `AttachConsole`),
  `missing_docs`, clippy pedantic, `unwrap_used`/`expect_used` denied outside tests. `//!`
  header on every non-trivial file, `///` on public items.

TypeScript:

- `src/app/`: app shell (providers, query client, main window layout, status bar, palette
  command wiring, tab rendering).
- `src/features/<feature>/`: `api/` (TanStack Query hooks), `components/`, `hooks/`, `store/`
  (Zustand), `lib/` (pure logic with tests), `types.ts`, and a public `index.ts`. Features import
  each other only through `index.ts`. M1 features: `about`, `command-palette`, `git-env`,
  `repositories`, `settings`, `windows`, `workspace`.
- `src/shared/`: `ipc/` (generated bindings and client), `ui/` (shadcn primitives),
  `components/` (`EmptyState`, `ErrorState`, `LoadingState`, `ConfirmDialog`, `InlineError`),
  `hooks/`, `lib/`.

File size: soft limit 200 non-blank lines, hard limit 300, for `.ts`, `.tsx`, `.rs` and `.mjs`
under `src/`, `src-tauri/src/`, `crates/` and `scripts/`. `scripts/check-file-size.mjs` (part of
`pnpm lint`) warns above 200 and fails above 300; ESLint's `max-lines` enforces 300 for TS too.

### Consequences

Good:

- `cargo test -p git-core` exercises the engine with no webview, so it is fast and runs in CI on
  all three platforms.
- New contributors can guess where code lives from the feature or module name.
- Small files keep diffs and reviews focused.

Bad:

- More files and more `index.ts` re-exports.
- Splitting a file to stay under the limit sometimes feels artificial; the soft limit is a
  warning so judgement can apply between 200 and 300 lines.

## Links

- [ADR 0002](0002-rust-owns-git-access.md), [ADR 0004](0004-frontend-stack.md)
- [../development/standards.md](../development/standards.md), [`CLAUDE.md`](../../CLAUDE.md)
