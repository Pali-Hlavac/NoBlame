# Installing NoBlame and git

## NoBlame

There are no installers yet. Until the first release, build and run NoBlame from source as
described in [Getting started](../getting-started.md).

## Git is required

NoBlame uses the git you already have installed. Commits, pushes, hooks, credentials and signing
then work exactly as they do in your terminal. NoBlame needs **git 2.39 or newer**.

When NoBlame starts, it looks for git in this order:

1. The program named in the `NOBLAME_GIT` environment variable, if it is set and exists.
2. Every folder on your `PATH`.
3. The usual install folders:
   - Windows: `Git\cmd` under Program Files, Program Files (x86) and your local app data folder.
   - macOS: Homebrew (`/opt/homebrew/bin`, `/usr/local/bin`), MacPorts (`/opt/local/bin`), and
     last the system git in `/usr/bin`.
   - Linux: `/usr/bin`, `/usr/local/bin` and `/bin`.

The git NoBlame found is shown in the status bar at the bottom of the window and in
**About NoBlame**, with its version and full path.

## If git is missing or too old

The Welcome tab and the status bar tell you. Install or upgrade git, then click
**Check again** (or the git entry in the status bar). You do not need to restart NoBlame.

- **Windows**: install Git for Windows from <https://git-scm.com/download/win>.
- **macOS**: run `xcode-select --install`, or install git with Homebrew: `brew install git`.
- **Linux**: install git with your package manager, for example `sudo apt install git`.

## Using a specific git

To use a git that is not on your `PATH`, or a newer one next to an older system git, set
`NOBLAME_GIT` to the full path of the git program before starting NoBlame.

Windows (PowerShell):

```powershell
$env:NOBLAME_GIT = "C:\Tools\git\cmd\git.exe"
```

macOS and Linux:

```sh
export NOBLAME_GIT=/opt/homebrew/bin/git
```

## Notes

- On macOS, `/usr/bin/git` only works when the Xcode Command Line Tools are installed. Without
  them NoBlame reports that git did not respond or could not be used.
- NoBlame never changes your global or system git configuration.
