# Git detection

NoBlame runs the user's installed git for every write and network operation, so it must find a
working git and say clearly when it cannot. Architecture: [git-engine.md](../architecture/git-engine.md).
User guide: [installing.md](../user-guide/installing.md).

Status: **M1 done.**

## Behaviour

- On start, `get_git_info` locates git (override `NOBLAME_GIT`, `PATH`, well-known folders) and
  runs `git --version` with a 10-second timeout.
- The status bar shows the result:

  | State    | Icon         | Label                | Meaning                                    |
  | -------- | ------------ | -------------------- | ------------------------------------------ |
  | Checking | spinner      | Checking git…        | Still looking                              |
  | OK       | green check  | Git 2.47.1           | Found and supported                        |
  | Too old  | yellow alert | Git 2.30.0 (too old) | Found, older than 2.39.0; things may break |
  | Missing  | red cross    | Git not available    | Not found, cannot start, or not git        |

  The tooltip explains the state and what to do. Clicking checks again (useful right after
  installing git), as does the palette command "Check git installation again".

- The Welcome tab and task windows show a notice with the explanation and a "Check again" button
  when git is missing or too old.
- About lists the version and full path.

## Error messages

| Situation                               | Code            | Message / hint                                                           |
| --------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| Not found anywhere                      | `GIT_NOT_FOUND` | "Git is not installed, or NoBlame cannot find it." + install hint per OS |
| Found but cannot be started             | `GIT_UNUSABLE`  | "Git at … could not be started: …" + install hint                        |
| Prints something that is not a version  | `GIT_UNUSABLE`  | "The program found as git does not look like git …"                      |
| No answer within 10 s (e.g. macOS shim) | `GIT_UNUSABLE`  | "Git did not respond." + check `git --version` in a terminal             |

Install hints: Git for Windows link (Windows); `xcode-select --install` or `brew install git`
(macOS); the distribution's package manager (Linux). All mention `NOBLAME_GIT`.

## Edge cases

- **macOS shim**: `/usr/bin/git` without Command Line Tools prints an `xcrun` error or opens an
  install dialog. It is searched last; failure or timeout gives a `GIT_UNUSABLE` message.
- **Windows**: the first git on `PATH` wins; with Git for Windows that may be
  `…\Git\cmd\git.exe` or `…\Git\mingw64\bin\git.exe` (or `ucrt64`), all fine.
- **Version strings** with vendor suffixes (`2.47.1.windows.2`, `2.39.5 (Apple Git-154)`) and
  release candidates (`2.48.0.rc1`) are parsed; only major.minor.patch is compared.
- `NOBLAME_GIT` pointing at a missing file falls back to the normal search.
