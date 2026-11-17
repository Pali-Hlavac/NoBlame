# Testing

| Layer                 | Where                                 | Tools                           | Run with         |
| --------------------- | ------------------------------------- | ------------------------------- | ---------------- |
| Rust unit tests       | next to the code (`#[cfg(test)]`)     | `cargo test`                    | `pnpm test:rust` |
| Git integration tests | `crates/git-core/tests/`              | real `git`, generated repos     | `pnpm test:rust` |
| Generator tests       | `crates/repo-gen/tests/`              | real `git`                      | `pnpm test:rust` |
| Frontend logic and UI | `src/**/*.test.ts(x)`                 | Vitest, Testing Library         | `pnpm test`      |
| Bindings up to date   | `src-tauri/src/ipc.rs` test + CI diff | tauri-specta                    | `pnpm bindings`  |
| Benchmarks            | `crates/git-core/benches/graph.rs`    | `criterion`, opt-in large repos | `pnpm bench`     |
| End to end            | M9                                    | WebdriverIO + `tauri-driver`    |                  |

CI runs everything on Linux, Windows and macOS (`.github/workflows/ci.yml`).

## Rust tests need git

Integration tests run the real git found on `PATH` (minimum 2.39). The cancellation test uses a
git alias that runs `sleep` through git's `sh`, which Git for Windows provides.

## Fixture repositories

Tests build repositories on the fly into temporary directories:

- `noblame_repo_gen::generate(&Preset::Tiny.spec(), dir)` creates a 200-commit repository with
  branches, merges, octopus merges, tags and `origin/*` remote refs in well under a second
  (`write_commit_graph(dir)` adds a commit-graph file). `crates/git-core` uses it as a
  dev-dependency.
- `crates/git-core/tests/support/mod.rs` provides `Fixture`, a scripted repository for focused
  cases. Git runs with an empty global config (`GIT_CONFIG_GLOBAL`), no system config
  (`GIT_CONFIG_NOSYSTEM`), a fixed identity and a fixed clock that advances one minute per commit,
  so results never depend on the developer's settings. Helpers: `new()`, `bare()`, `commit()`,
  `commit_bytes()` (raw, e.g. non-UTF-8, messages), `merge()`, `git()` and `run()` (any git
  command, e.g. `worktree add` or `clone --depth 1`).
- More fixtures (renames, conflicts, submodules, LFS pointers, CRLF, very long paths) are added
  with the features that need them.

## Repository and graph tests

- `crates/git-core/tests/repo_open.rs`: normal, bare, linked worktree, subfolder discovery,
  unborn branch, detached HEAD, shallow clone, commit-graph detection, plain folder.
- `crates/git-core/tests/graph_build.rs`: the full row order equals
  `git log --all --date-order` on the tiny synthetic repository, with and without a commit-graph
  file; commits newer than the commit-graph file; branch, tag and HEAD labels; merges and a
  detached HEAD; non-UTF-8 messages; an empty repository; a shallow clone.
- Unit tests in `crates/git-core/src/graph/tests.rs` lay out hand-built histories (linear, merge,
  octopus, unrelated roots, clock skew) and check exact lanes and edges, and that blocks replayed
  from checkpoints continue seamlessly.

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

After generation the refs are packed (`git pack-refs --all`), as in a clone: loose refs made
reading 10,500 refs take 1.4 s instead of 0.24 s. Commits are on average about 8 minutes apart
(30 s plus up to 15 minutes), so a million commits span about 15 years.

Not simulated yet: renames, deletions, binary files, submodules, huge files. Add them when a
feature needs them in benchmarks.

## Frontend tests

- Pure functions in `lib/` get plain unit tests.
- Components are tested through roles and labels (`getByRole("combobox", { name: … })`), as a
  user would find them.
- The IPC bindings are mocked per test file with `vi.mock("@/shared/ipc/bindings", …)`.
- `src/test/setup.ts` adds jest-dom matchers and stubs `matchMedia` and `ResizeObserver`.
- `pnpm test:a11y` runs the frontend tests with an axe-core audit of what each one renders
  (`scripts/a11y-setup.mjs`, rules and accepted patterns in `src/test/axe.ts`) and prints the
  problems by rule; CI runs it on Linux. Contrast cannot be measured in jsdom:
  `src/app/contrast.test.ts` checks the theme's tokens against WCAG ratios instead, so a colour
  changed in `styles.css` is checked by `pnpm test`.

## Regression tests

Every bug fixed gets a test that fails without the fix. Check it really does by reverting the fix
locally once (done for the command palette ranking bug in M1).

## Benchmarks and the graph spike

- `crates/git-core/benches/graph.rs` (`pnpm bench`, or
  `cargo bench -p git-core --bench graph`) measures `Graph::build` and `encode_block`. The tiny
  repository is generated on the fly every run; `synthetic-100k` and `synthetic-1m` are used only
  when they exist in `.cache/repos/` (the 1M group takes 10 samples).
- `crates/git-core/examples/graph_spike.rs` prints the phase timings (open, refs, index, order,
  layout), the time to the first screen and the cost of replaying blocks:

  ```sh
  cargo run --release -p git-core --example graph_spike -- .cache/repos/synthetic-1m
  ```

Record results in [performance.md](performance.md).
