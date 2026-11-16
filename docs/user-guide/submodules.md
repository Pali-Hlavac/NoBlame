# Submodules

A submodule is another repository kept inside yours, in a folder of its own. Your repository
records which commit of it to use.

## In the Repositories module

Your submodules are listed below their repository, and their own submodules below them.

- A **grey** submodule has not been downloaded yet. Right-click it and choose **Initialize**.
- **new commits** next to a submodule means it has another commit checked out than the one your
  repository records. Point at it to see both.

Right-click a submodule, or use its **…** button, for:

- **Initialize**: download it and check out the recorded commit.
- **Update to the recorded commit**: put it back on the commit your repository records.
- **Copy path**.

The **…** button of a repository with submodules has **Update all submodules**: it initializes
the ones not downloaded yet and updates the others. Submodules inside submodules are included
every time.

These run in the background like a fetch: a message shows how it goes, and you can cancel it.
If a submodule with new commits would be moved back, NoBlame asks first and lists which ones.
Nothing is lost: the commits made there are still in that submodule's branches or its reflog.
If the submodule has uncommitted changes in the way, Git refuses and says so.

## Keeping submodules on the recorded commits

When your repository records other submodule commits than the ones checked out (for example
after a pull or after switching branches), a bar above the commits says which submodules are
not on the recorded commits. Click **Update** to put them there, or **×** to leave them as they
are; the bar comes back when the recorded commits change again.

You can also right-click such a submodule in the Commit module or in Changed files and choose
**Check out the recorded commit**.

In **Settings → Submodules**:

- **Fetch the submodules too** (on): every fetch also fetches your submodules.
- **Update the submodules after pull and checkout** (off): pulling and switching branches move
  the submodules to the recorded commits by themselves. Submodules you have not downloaded yet
  are left alone.

## What changed in a submodule

When you choose a submodule in **Changed files**, the diff shows which commit it pointed to
before and after, and the commits in between: the ones added, and the ones removed if it went
back. For your uncommitted changes it also says whether the submodule has changed or new files
of its own. **Open the submodule** opens it in a tab of its own.

If the submodule does not have those commits yet, fetch in the submodule first.
