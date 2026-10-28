# NoBlame documentation

Start here. [CLAUDE.md](../CLAUDE.md) at the repository root is the short map for contributors
and AI agents; these pages are the detail.

## Product and plan

- [project-brief.md](project-brief.md): what we are building and the requirements
- [roadmap.md](roadmap.md): milestones, agreed decisions, ADR plan, where we left off
- [design/workbench.md](design/workbench.md): proposed workbench layout and the owner's idea inbox
- [CHANGELOG.md](../CHANGELOG.md): what changed, per release

## Getting started

- [getting-started.md](getting-started.md): prerequisites per OS, install, run, test

## Architecture

- [overview.md](architecture/overview.md): components, data flow, threading model
- [ipc.md](architecture/ipc.md): every command and event; the binary graph block format
- [git-engine.md](architecture/git-engine.md): `gix` vs. the `git` CLI, the safe command runner
- [commit-graph.md](architecture/commit-graph.md): walk, order, lane layout, blocks, rendering
- [background-jobs.md](architecture/background-jobs.md): job model, progress, cancel, logs
- [cli-and-windows.md](architecture/cli-and-windows.md): command line, single instance, task
  windows
- [security.md](architecture/security.md): untrusted repositories, arguments, credentials

## Features

One page per user-facing feature: behaviour, edge cases and status.

- [app-shell.md](features/app-shell.md): main window, tabs, sidebar, status bar, palette, theme,
  About
- [git-detection.md](features/git-detection.md): finding and checking the installed `git`
- [cli.md](features/cli.md): the `noblame` command line and task windows
- [repositories.md](features/repositories.md): opening, creating and recent repositories, the
  commit-graph offer
- [commit-graph.md](features/commit-graph.md): the commit graph and its columns

## User guide

Plain-language pages for people using NoBlame: [user-guide/README.md](user-guide/README.md).

## Decisions

Architecture decision records: [adr/README.md](adr/README.md).

## Development

- [standards.md](development/standards.md): code standards and conventions
- [testing.md](development/testing.md): test layers, fixtures, the synthetic repository generator
- [performance.md](development/performance.md): benchmarks, large repositories, recorded numbers
- [release.md](development/release.md): versioning and releases
- [troubleshooting.md](development/troubleshooting.md): known build and runtime problems
