# Code standards

The rules every change follows. [CLAUDE.md](../../CLAUDE.md) has the short version; this page
explains them. Organization: [ADR 0005](../adr/0005-code-organization.md).

## General

- Simple, explicit, well-tested code over clever code. Leave every file better than you found it.
- **File size**: soft limit 200 lines, hard limit 300 (non-blank lines; `scripts/check-file-size.mjs`
  in `pnpm lint` warns and fails). Split early: by responsibility, not alphabetically.
- **No magic numbers**: name constants (`VERSION_TIMEOUT`, `MAIN_WINDOW_SIZE`, `SOFT_LIMIT`).
- **Naming**: components `PascalCase.tsx`; hooks `useThing.ts`; other TS `camelCase.ts`; Rust
  `snake_case`. Commands are verbs: `get_git_info`, `open_task_window`.
- **Comments** explain why, not what. Every non-trivial Rust file starts with a `//!` header;
  every public Rust item has `///` docs (`missing_docs` warns, clippy denies warnings).

## Rust

- Workspace lints (`Cargo.toml`): `unsafe_code = "deny"` (the one exception, attaching to the
  parent console on Windows, is a documented `#[allow]`), `clippy::pedantic`, and
  `unwrap_used` / `expect_used` denied outside tests (`clippy.toml` allows them in tests;
  integration-test files opt in with a file-level `#![allow]`).
- Errors: one `thiserror` enum per module, converted with `From` into `AppError` at the Tauri
  boundary ([ADR 0006](../adr/0006-error-model.md)). Messages are for end users; hints say what to do next.
- `crates/git-core` must never depend on Tauri.
- Module shape in `src-tauri`: `mod.rs` (public surface, `init`), `commands.rs` (thin Tauri
  boundary), `service.rs` (logic), `error.rs`, `types.rs`.
- Any command doing I/O is `async`. CPU-heavy work goes to `spawn_blocking`.
- Edition 2024, `rustfmt` defaults (`rustfmt.toml`).

## TypeScript and React

- `strict`, `noUncheckedIndexedAccess`, no `any`, no `!` without a comment, `import type` for
  types (ESLint `strictTypeChecked`).
- Feature folders: `components/ hooks/ api/ store/ lib/ types.ts` and a public `index.ts`.
  Import other features only through their `index.ts`.
- Backend data: TanStack Query hooks in `api/`, with `unwrap(commands.x())`. UI-only state:
  Zustand in `store/`. Never copy query data into Zustand.
- Pure logic goes into `lib/` with unit tests (`describeGitStatus`, `repositoryName`).
- Styling: Tailwind utilities and tokens from `src/app/styles.css`, merged with `cn()`. No inline
  colours.
- Accessibility: every interactive element has a visible focus state and an accessible name;
  `eslint-plugin-jsx-a11y` runs in lint, `pnpm test:a11y` audits the rendered components with
  axe-core, and `src/app/contrast.test.ts` keeps text at 4.5:1 and focus rings and graph lines at
  3:1 in both themes. A list option holds no controls of its own: buttons in a row are for the
  mouse (`aria-hidden` wrapper, `tabIndex={-1}`, no focus on mouse down) and the keyboard does
  the same through the list.
- Every async view renders loading, error and empty states (`LoadingState`, `ErrorState`,
  `EmptyState`).

## Git safety

- Always `git_core::cli::GitCommand`. Literal flags with `arg()`; values with `option()`,
  `revision()` or `paths()`. Read-only commands call `.read_only()`.
- Parse machine-readable output only (`-z`, `--porcelain=v2`, NUL-separated `--format`).
- Keep paths and messages as bytes; convert lossily only for display.
- Dangerous actions (reset --hard, force push, delete unmerged branch, discard, clean, drop
  stash) use `ConfirmDialog` with a description that names exactly what will be lost.

## Stubs

Placeholders are labelled in the UI ("Placeholder: … arrives in M8"), in the feature doc and in
the changelog. Nothing pretends to work.

## Commits

Conventional Commits (`feat:`, `fix:`, `perf:`, `docs:`, `test:`, `chore:`, `refactor:`,
`ci:`), enforced by commitlint in the `commit-msg` hook and in CI for pull requests. The
`pre-commit` hook runs ESLint, Prettier and rustfmt on staged files (lint-staged).

## Dependencies

Check the licence of every new dependency (no GPL code in the app). Pin pre-releases exactly and
record fragile pins in CLAUDE.md → Gotchas. Never copy code from Git Extensions or TortoiseGit.
Run `pnpm deps:check` after adding or updating dependencies; CI checks advisories, licences and
sources too ([dependencies.md](dependencies.md)).
