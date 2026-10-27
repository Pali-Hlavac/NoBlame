# Testing

| Layer                 | Where                                 | Tools                           | Run with         |
| --------------------- | ------------------------------------- | ------------------------------- | ---------------- |
| Rust unit tests       | next to the code (`#[cfg(test)]`)     | `cargo test`                    | `pnpm test:rust` |
| Git integration tests | `crates/git-core/tests/`              | real `git`, generated repos     | `pnpm test:rust` |
| Generator tests       | `crates/repo-gen/tests/`              | real `git`                      | `pnpm test:rust` |
| Frontend logic and UI | `src/**/*.test.ts(x)`                 | Vitest, Testing Library         | `pnpm test`      |
| Bindings up to date   | `src-tauri/src/ipc.rs` test + CI diff | tauri-specta                    | `pnpm bindings`  |
| Benchmarks            | `benches/` (from M2)                  | `criterion`, opt-in large repos | `pnpm bench`     |
| End to end            | M9                                    | WebdriverIO + `tauri-driver`    |                  |

CI runs everything on Linux, Windows and macOS (`.github/workflows/ci.yml`).

## Rust tests need git

Integration tests run the real git found on `PATH` (minimum 2.39). The cancellation test uses a
git alias that runs `sleep` through git's `sh`, which Git for Windows provides.

## Fixture repositories

Tests build repositories on the fly into temporary directories:

- `noblame_repo_gen::generate(&Preset::Tiny.spec(), dir)` creates a 200-commit repository with
  branches, merges, octopus merges, tags, `origin/*` remote refs and a commit-graph file, in well
  under a second. `crates/git-core` uses it as a dev-dependency.
- Focused fixtures (renames, conflicts, submodules, LFS pointers, non-UTF-8 names, CRLF, very
  long paths, shallow clones, empty repositories) are added with the features that need them,
  as small scripted builders in `crates/git-core/tests/support/`.

## Synthetic repository generator

`crates/repo-gen` (binary `noblame-repo-gen`, run via `pnpm repos:generate`) simulates a team:
work on `main` and on topic branches, topic branches merged back (2 % of merges are octopus
merges), merged branches archived as `feature/*`, annotated tags on `main`, non-ASCII author
names, and `refs/remotes/origin/*` for every branch. It writes a `git fast-import` stream directly
into git, so large repositories are fast to build, and it is deterministic: the same preset
always produces the same commit ids.

| Preset | Commits   | Files  | Active topics | Archived branches | Tag every |
| ------ | --------- | ------ | ------------- | ----------------- | --------- |
| tiny   | 200       | 60     | 3             | 5                 | 40        |
| 10k    | 10,000    | 2,000  | 8             | 200               | 100       |
| 100k   | 100,000   | 10,000 | 24            | 2,000             | 500       |
| 1m     | 1,000,000 | 40,000 | 64            | 5,000             | 1,000     |

```sh
pnpm repos:generate                         # 10k and 100k into .cache/repos/
pnpm repos:generate --preset 1m             # 1M commits
pnpm repos:generate --commits 250000        # custom size, 100k shape
pnpm repos:generate --force                 # rebuild existing ones
pnpm repos:generate --no-commit-graph       # skip the commit-graph file
```

`.cache/` is git-ignored. `--force` deletes only folders named `synthetic-*`.

Not simulated yet: renames, deletions, binary files, submodules, huge files. Add them when a
feature needs them in benchmarks.

## Frontend tests

- Pure functions in `lib/` get plain unit tests.
- Components are tested through roles and labels (`getByRole("combobox", { name: … })`), as a
  user would find them.
- The IPC bindings are mocked per test file with `vi.mock("@/shared/ipc/bindings", …)`.
- `src/test/setup.ts` adds jest-dom matchers and stubs `matchMedia` and `ResizeObserver`.

## Regression tests

Every bug fixed gets a test that fails without the fix. Check it really does by reverting the fix
locally once (done for the command palette ranking bug in M1).
