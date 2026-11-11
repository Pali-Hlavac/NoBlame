# Git settings

Git has settings of its own, such as your name in commits or whether pulling rebases. NoBlame
shows and changes them in **Settings** (the gear at the bottom of the activity bar) → **Git
settings**, for the repository you are looking at.

## Which settings

Choose first whose settings you change:

- **This repository's**: only this repository. They win over your user settings.
- **Your user settings**: every repository of your user account on this computer, unless one
  sets its own.

The file they are kept in is named below the choice.

## Changing a setting

The common settings are listed with what they do: your name and email, pulling by rebasing,
pruning when fetching, pushing new branches upstream, the first branch of new repositories,
line endings, signing commits and fast-forward merges. Type a value and click **Save**, or click
**Remove** to stop setting it in that file (Git then uses the other file's value, or its
default).

Other settings in the file are listed below them. To set one that is not listed, type its name
(such as `alias.st`) and value at the bottom and click **Add**.

Nothing changes until you click Save, Remove or Add.
