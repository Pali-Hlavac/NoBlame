# Finding a bad commit (bisect)

Something worked a while ago and is broken now, and there are many commits in between. Bisect
finds the commit that broke it in a few steps, by halving the range each time: about 10 steps
for a thousand commits.

## Starting

1. In the commit graph, right-click a commit that has the problem (often the newest one) and
   choose **More** → **Bisect: mark as bad (has the problem)**. NoBlame explains what happens
   next; choose **Start bisecting**.
2. Right-click a commit that did not have the problem and choose **More** → **Bisect: mark as
   good (does not have it)**.

You can also start the other way round, with the good commit first.

Bisecting checks out older commits, so commit or stash your changes first. While it runs, you
are not on a branch.

## Testing

NoBlame checks out the commit halfway between. The bar above the commits says which one it is
and how many are left. Build it, run it, test it, then choose:

- **Good** if it does not have the problem;
- **Bad** if it has it;
- **Skip** if you cannot test it (it does not build, for example).

NoBlame checks out the next commit, until it names the first bad commit. The commits you marked
show `bad`, `good` and `skipped` labels in the graph. You can also mark any commit from its
right-click menu.

## Finishing

When the bar says **Found the first bad commit**, choose **Show it** to select it in the graph
and look at what it changed. Then choose **Stop bisecting**: you are back on the branch you
started from.

You can stop at any time with **Stop bisecting**; the marks are then forgotten.
