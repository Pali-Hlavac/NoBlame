import { PackageIcon } from "lucide-react";

import { formatCommitDate, shortId } from "@/features/graph";
import { openRepositories, useRepositoryPath } from "@/features/repositories";
import type { PointerCommitDto, PointerLogDto } from "@/shared/ipc/bindings";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { Button } from "@/shared/ui/button";

import { useSubmoduleLog } from "../api/submodule";
import type { DiffFile } from "../lib/diffFile";
import { insideText, pointerChange, pointerText, submoduleFolder } from "../lib/submodule";

function CommitList({
  title,
  commits,
  more,
}: {
  title: string;
  commits: readonly PointerCommitDto[];
  more: boolean;
}) {
  if (commits.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1.5">
        {commits.map((commit) => (
          <li key={commit.id} className="text-sm" title={commit.id}>
            <span className="block truncate">{commit.summary}</span>
            <span className="block truncate text-xs text-muted-foreground">
              <span className="font-mono">{shortId(commit.id)}</span> · {commit.author},{" "}
              {formatCommitDate(commit.time)}
            </span>
          </li>
        ))}
      </ul>
      {more && <p className="text-xs text-muted-foreground">Only the newest 200 are listed.</p>}
    </section>
  );
}

function count(commits: readonly PointerCommitDto[], more: boolean, word: string): string {
  const number = `${commits.length.toLocaleString()}${more ? "+" : ""}`;
  return `${number} ${commits.length === 1 && !more ? "commit" : "commits"} ${word}`;
}

function Commits({ log }: { log: PointerLogDto }) {
  if (log.added.length === 0 && log.removed.length === 0) return null;
  return (
    <div className="space-y-3">
      <CommitList
        title={count(log.added, log.moreAdded, "added")}
        commits={log.added}
        more={log.moreAdded}
      />
      <CommitList
        title={`${count(log.removed, log.moreRemoved, "removed")}: it went back or to another line`}
        commits={log.removed}
        more={log.moreRemoved}
      />
    </div>
  );
}

/**
 * A submodule's diff: where its pointer went, the commits added and removed between the two
 * (read in its own clone, like `git diff --submodule=log`), and changes inside it.
 */
export function SubmoduleDiff({ repoId, file }: { repoId: number; file: DiffFile }) {
  const change = pointerChange(file);
  const root = useRepositoryPath(repoId);
  const changed = change.kind === "changed";
  // An added submodule is read too (from its commit to itself): that tells whether it is
  // checked out here, so it can be opened.
  const pointers =
    change.kind === "changed"
      ? change
      : change.kind === "added"
        ? { from: change.to, to: change.to }
        : null;
  const log = useSubmoduleLog(
    repoId,
    file.path,
    pointers?.from ?? "",
    pointers?.to ?? null,
    pointers !== null,
  );
  const data = log.data;
  const checkedOut = data?.kind === "log" ? data.to : undefined;
  const inside = insideText(file.submoduleChanges);
  let details = null;
  if (!changed) {
    // Added or removed: there are no commits between two pointers to list.
  } else if (log.error) {
    details = (
      <ErrorState
        error={log.error}
        title="Could not read the submodule's commits"
        onRetry={() => void log.refetch()}
      />
    );
  } else if (data === undefined) {
    details = <LoadingState label="Reading the submodule's commits…" />;
  } else if (data.kind === "missing") {
    details = (
      <p className="text-sm text-muted-foreground">
        The submodule's clone does not have these commits. Fetch in the submodule, then look again.
      </p>
    );
  } else if (data.kind === "notCheckedOut") {
    details = (
      <p className="text-sm text-muted-foreground">
        The submodule is not checked out, so its commits cannot be listed. Initialize it in the
        Repositories module.
      </p>
    );
  } else {
    details = <Commits log={data} />;
  }
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
      <div className="flex items-start gap-3">
        <PackageIcon className="mt-0.5 size-5 shrink-0 text-kind-submodules" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="font-medium">Submodule {file.path}</h2>
          <p className="text-sm">{pointerText(change, checkedOut)}</p>
          {inside && <p className="text-sm">{inside}</p>}
          {/* Not when it is not checked out: opening its empty folder would open this one. */}
          {root && data !== undefined && data.kind !== "notCheckedOut" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => {
                openRepositories([submoduleFolder(root, file.path)]);
              }}
            >
              Open the submodule
            </Button>
          )}
        </div>
      </div>
      {details}
    </div>
  );
}
