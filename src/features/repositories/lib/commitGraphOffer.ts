/**
 * What the commit-graph notice says. After a slow first load it names the cost (how long
 * reading took, how long writing the file would take) so the offer is worth reading.
 */

/** A first load slower than this makes the notice prominent. */
export const SLOW_LOAD_MS = 2_000;
/** `git commit-graph write` cost per commit, measured on the Linux kernel (11 s, 1.5M commits). */
const WRITE_SECONDS_PER_COMMIT = 11 / 1_500_000;
const SECONDS_PER_MINUTE = 60;

const numbers = new Intl.NumberFormat("en-US");

export interface CommitGraphOffer {
  /** The first load was slow: show the notice prominently. */
  prominent: boolean;
  message: string;
}

/** "about 11 seconds", "about 2 minutes", "a few seconds". */
export function describeDuration(seconds: number): string {
  if (seconds < 5) return "a few seconds";
  if (seconds < 90) return `about ${Math.round(seconds)} seconds`;
  return `about ${Math.round(seconds / SECONDS_PER_MINUTE)} minutes`;
}

/** The notice text for a graph of `rows` commits that took `buildMs` to load. */
export function commitGraphOffer(
  graph: { rows: number; buildMs: number | null } | undefined,
): CommitGraphOffer {
  const buildMs = graph?.buildMs ?? 0;
  if (!graph || buildMs < SLOW_LOAD_MS) {
    return {
      prominent: false,
      message:
        "History loads much faster with a commit-graph file. Writing it adds one index file to the .git folder; commits, branches and your files do not change.",
    };
  }
  const took = (buildMs / 1000).toFixed(1);
  const write = describeDuration(graph.rows * WRITE_SECONDS_PER_COMMIT);
  return {
    prominent: true,
    message: `Reading ${numbers.format(graph.rows)} commits took ${took} s. With a commit-graph file it takes a fraction of that. Writing one takes ${write}, once, and only adds an index file to the .git folder; commits, branches and your files do not change.`,
  };
}
