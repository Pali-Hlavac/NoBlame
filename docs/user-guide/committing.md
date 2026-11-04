# Committing

Click **Commit** in the toolbar (or press Alt+7, or choose **Commit…** in the command palette or
in a repository's **…** menu) to commit the changes of the active repository.

## Where it opens

The Commit module opens in the sidebar. Choosing a file shows its diff in the diff tab, so you
can keep the commit graph in view.

To commit in a larger window instead, right-click the **Commit** tab and choose **Pop out**
([Popping a module out](main-window.md#popping-a-module-out)). From then on Commit opens in a
popup over the window, with the diff of the chosen file beside the lists. The rest of NoBlame
waits until you close it (Esc or ×), and it closes by itself after a commit. **Dock** in its
header puts it back in the sidebar.

Both show the same lists and the same message. What you type is kept while NoBlame runs, so you
can close the popup, look at something else, and come back to your message.

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

Point at a changed file and click **↶** to throw its changes away, or **↶** in the Changes
header to throw away every change. NoBlame asks first and names what is lost: a changed file goes
back to its staged version (or the last commit's), and a new file is deleted for good (not moved
to the recycle bin). Files with conflicts are left alone.

## Staging part of a file

In the diff of a changed or staged file:

- each hunk (a block of changes, starting with `@@`) has buttons on its header: **Stage hunk** and
  **Discard hunk…** for your changes, **Unstage hunk** for staged ones;
- click a changed line's numbers to choose it, and Shift+click another to choose every changed
  line in between. The bar above the diff then says how many are chosen, with **Stage**,
  **Discard…** (or **Unstage**) and **Clear**.

What you choose is staged exactly: other changes in the file stay as they are, in the working tree.
Discarding asks first, as it cannot be undone. If the file changed since its diff was shown (you
saved it in your editor), nothing happens and NoBlame asks you to choose again in the new diff.
A file with conflicts can only be staged whole.

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
