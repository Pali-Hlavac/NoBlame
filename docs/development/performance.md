# Performance

Performance on giant repositories is the number-one technical requirement. Measure, don't guess:
every feature that touches history, status or diffs is checked on a large repository, and the
numbers are recorded here.

## Targets

The current targets are in the [roadmap](../roadmap.md#performance-targets-first-guesses-to-be-measured-and-revised-in-m2)
(first open of a 1.3M-commit graph under 1 s, 60 fps scrolling, under 200 bytes per commit).
M2 measures them and revises them.

## Test repositories

### Synthetic (deterministic)

Built by `pnpm repos:generate` into `.cache/repos/` ([testing.md](testing.md)). Same preset,
same commit ids, on every machine.

### Real (opt-in)

Real repositories are cloned by hand into `.cache/repos/` (git-ignored) and never committed:

| Repository                                     | Why                                                     |
| ---------------------------------------------- | ------------------------------------------------------- |
| `torvalds/linux` (~1.3M commits)               | Reference for the roadmap targets; deep merge structure |
| `chromium/chromium` (~1.5M commits, huge tree) | Very large working tree and ref count                   |
| `llvm/llvm-project` (~550k commits)            | Large monorepo, mostly linear                           |

Benchmarks that use them are opt-in and skip when the folder is missing (from M2).

## Benchmarks

`pnpm bench` runs `cargo bench --workspace`. There are no benchmarks yet: the first ones arrive
with the M2 spike (history walk with `gix` and the commit-graph file on `synthetic-1m`), as
`criterion` benches in `crates/git-core/benches/`.

## Recorded numbers

### Synthetic repository generation (2026-10-27)

Machine: Windows 11 Pro, git 2.56.0, release build of `noblame-repo-gen`. The 1M run shared the
machine with cargo builds and the dev app, so treat it as an upper bound.

| Preset | Commits   | Merges (octopus) | Branches | Tags | Refs total | Generate | commit-graph write | Size on disk |
| ------ | --------- | ---------------- | -------- | ---- | ---------- | -------- | ------------------ | ------------ |
| 10k    | 10,000    | 749 (17)         | 209      | 53   | ~470       | 3.0 s    | 0.35 s             | 13 MB        |
| 100k   | 100,000   | 7,940 (175)      | 2,025    | 89   | ~4,140     | 34.8 s   | 3.9 s              | 118 MB       |
| 1m     | 1,000,000 | 79,765 (1,619)   | 5,065    | 449  | 10,570     | 627.6 s  | 68.2 s             | 1.2 GB       |

"Branches" counts `refs/heads/*`; every branch also has an `origin/*` remote-tracking ref.
Generation time is dominated by `git fast-import`. The repositories are not repacked afterwards
(`git gc` would shrink them; benchmarks may want both variants).

### App

Nothing in M1 touches history, status or diffs, and no app timings were taken. Startup, the git
probe and second-launch forwarding get measured when the dashboard and graph land in M2.
