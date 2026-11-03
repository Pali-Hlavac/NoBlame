# Committing

Click **Commit** in the toolbar (or press Alt+7, or choose **Commit…** in the command palette or
in a repository's **…** menu) to commit the changes of the active repository.

## Where it opens

**Settings → Committing** chooses where the commit window opens:

- **The Commit module** in the sidebar (the default). Choosing a file shows its diff in the diff
  tab, so you can keep the commit graph in view.
- **A dialog** over the window, with the diff of the chosen file beside the lists. The rest of
  NoBlame waits until you close it (Esc or ×). It closes by itself after a commit.

Both show the same lists and the same message. What you type is kept while NoBlame runs, so you
can close the dialog, look at something else, and come back to your message.

## Staging

The **Changes** list has the files you changed, new files (**?**) and files with merge conflicts
(**U**). The **Staged** list has what goes into the next commit.

- Click a file to see its diff.
- Point at a file and click **+** to stage it, or **−** to unstage it. With the keyboard, move to
  the file with the arrows and press **Space**.
- **Stage all** and **Unstage all** move every file at once.
- Staging a file with conflicts tells Git you have resolved them. NoBlame asks first; check that
  no conflict markers (`<<<<<<<`, `>>>>>>>`) are left in the file.

On a very large working tree, staging thousands of files can take a few seconds. The list says
**Staging…** meanwhile.

Staging parts of a file (hunks and single lines) and discarding changes come in a later version.

## The message and committing

Write the message in the box: the first line is the summary, then an empty line, then the
details. Press **Ctrl+Enter** (⌘Enter on macOS) or click **Commit**.

- **Amend last commit** replaces the last commit with a new one: what you staged is added to it,
  and its message is filled in for you to edit. Untick it to take that message away again. Do
  not amend a commit you have already pushed, unless you mean to rewrite it.
- **Sign off** adds a `Signed-off-by:` line with your name, as some projects require.

NoBlame commits with your own Git, so your Git settings apply: your name and e-mail, signing
your commits with GPG or SSH (`commit.gpgSign`), and your hooks. When a hook refuses the commit,
its message is shown under the button and your message is kept, so you can fix the problem and
try again. After a commit, Git's summary line is shown (`[main 1a2b3c4] Fix the parser`), and
the commit graph shows the new commit.

The Commit button is greyed out until something is staged (or Amend is ticked) and the message
is not empty; the text beside it says which is missing.
