# User scripts

M7 slice 6. Git commands the user writes once in **Settings → Scripts** and runs on a commit from
its menu (**More → Run a script**), with the output in a job. User guide:
[user-guide/scripts.md](../user-guide/scripts.md).

## Writing a script

A script is a name and git's arguments (a leading `git` is dropped), stored in the settings
(`scripts: [{ name, command }]`, `src-tauri/src/settings/types.rs`). Placeholders:

| Placeholder | Stands for                                   |
| ----------- | -------------------------------------------- |
| `{sha}`     | the commit's full id                         |
| `{short}`   | its first 8 characters                       |
| `{subject}` | its subject line                             |
| `{branch}`  | the branch checked out (refused if detached) |
| `{repo}`    | the repository's folder                      |

Settings checks a script before adding it (`lib/scripts.ts`: a name not used yet, arguments,
closed quotes, known placeholders); the backend checks again when it runs.

## Running one

`run_script` (`src-tauri/src/jobs/script.rs`) reads the script from the settings by name (the
webview never sends a command line to run), then `git_core::script`:

1. splits the line into arguments: spaces separate them, `"…"` and `'…'` group words, no
   escapes and no shell;
2. fills in the placeholders inside each argument, so a value with spaces stays one argument;
   an argument that is only a placeholder must not start with `-` (it would become an option);
   `{…}` that is not a name (`HEAD@{1}`) stays as written;
3. runs `git <arguments>` in the repository as a job (kind `script`, titled with the script's
   name, cancellable). Its output is in the job's log and the Git output window.

The arguments go through `GitCommand::user_args`: the user's own command line, like typing it in
a terminal, with the app's safety overrides (`LC_ALL=C`, no terminal prompt, no console window).

## Not yet

- Programs other than git, and asking for confirmation before a script runs.
- Placeholders for a file (`{file}`) and scripts in the branch and file menus.
- Editing a script in place (remove it and add it again).
