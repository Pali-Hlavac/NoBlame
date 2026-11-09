import { MousePointerClickIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WithActiveRepository } from "@/features/repositories";
import { useWorkingTreeStatus } from "@/features/working-tree";
import { MERGE_TAB, useTabsStore } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useMergeFile, useSaveMerged } from "../api/mergeView";
import { useCurrentBranch } from "../hooks/useCurrentBranch";
import { sideNames } from "../lib/conflicts";
import { conflictIndices, mergedText, textFor } from "../lib/mergeView";
import { decide, forgetDecisions, useDecisions, useShownMergeFile } from "../store/mergeView";
import { ConflictChunk } from "./ConflictChunk";
import { MergeHeader } from "./MergeHeader";
import { MergeUnavailable } from "./MergeUnavailable";
import { ResolvedChunk } from "./ResolvedChunk";

/** Space left above a conflict scrolled to. */
const SCROLL_MARGIN_PX = 8;

/** The Merge tab: the conflicted file chosen for the active repository, merged line by line. */
export function MergeView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <WithActiveRepository>{(summary) => <MergeBody repoId={summary.id} />}</WithActiveRepository>
    </div>
  );
}

function MergeBody({ repoId }: { repoId: number }) {
  const path = useShownMergeFile(repoId);
  useEffect(() => {
    const name = path?.split("/").pop();
    useTabsStore.getState().setTitle(MERGE_TAB.id, name ? `Merge: ${name}` : "Merge");
  }, [path]);
  if (!path) {
    return (
      <EmptyState
        icon={MousePointerClickIcon}
        title="No file chosen"
        description="Choose Merge on a conflicted file in Resolve conflicts (in the bar above the commits) to merge it here."
        className="flex-1"
      />
    );
  }
  return <MergeFile key={path} repoId={repoId} path={path} />;
}

function MergeFile({ repoId, path }: { repoId: number; path: string }) {
  const merged = useMergeFile(repoId, path);
  const decisions = useDecisions(repoId, path);
  const save = useSaveMerged(repoId);
  const head = useCurrentBranch(repoId);
  const operation = useWorkingTreeStatus(repoId).data?.operation;
  const names = sideNames(operation, head === "HEAD" ? "your branch" : head);
  const [showBase, setShowBase] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  if (merged.error) {
    return (
      <ErrorState
        error={merged.error}
        title={`Could not merge ${path}`}
        onRetry={() => void merged.refetch()}
        className="flex-1 justify-center"
      />
    );
  }
  if (!merged.data) return <LoadingState label="Merging the file…" className="flex-1" />;
  if (merged.data.kind === "unavailable") {
    return <MergeUnavailable repoId={repoId} path={path} reason={merged.data.reason} />;
  }

  const { chunks, crlf } = merged.data;
  const conflicts = conflictIndices(chunks);
  const open = conflicts.filter((index) => !decisions[index]);
  const takeRest = (side: "ours" | "theirs") => {
    const changes = Object.fromEntries(
      open.flatMap((index) => {
        const chunk = chunks[index];
        return chunk?.kind === "conflict"
          ? [[index, { how: side, text: textFor(side, chunk) }]]
          : [];
      }),
    );
    decide(repoId, path, changes);
  };

  return (
    <>
      <MergeHeader
        path={path}
        names={names}
        decided={conflicts.length - open.length}
        total={conflicts.length}
        showBase={showBase}
        onShowBase={setShowBase}
        onNext={() => {
          const scroller = list.current;
          const next = scroller?.querySelector<HTMLElement>('[data-conflict="open"]');
          if (!scroller || !next) return;
          // Scroll the list only: scrollIntoView would scroll the tab's containers too and hide
          // the header.
          const offset = next.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
          scroller.scrollTo({ top: scroller.scrollTop + offset - SCROLL_MARGIN_PX });
          next.querySelector("button")?.focus({ preventScroll: true });
        }}
        onRest={takeRest}
        onStartOver={() => {
          forgetDecisions(repoId, path);
        }}
        saving={save.isPending}
        error={save.error}
        onSave={() => {
          const text = mergedText(chunks, decisions);
          if (text !== null) save.mutate({ path, text, crlf });
        }}
      />
      <div ref={list} className="min-h-0 flex-1 overflow-auto py-1">
        {chunks.map((chunk, index) =>
          chunk.kind === "resolved" ? (
            // Chunks never move while the file is shown: the index is their identity.
            <ResolvedChunk key={index} source={chunk.source} text={chunk.text} />
          ) : (
            <div key={index} className="px-2">
              <ConflictChunk
                conflict={chunk}
                number={conflicts.indexOf(index) + 1}
                total={conflicts.length}
                decision={decisions[index]}
                names={names}
                showBase={showBase}
                onDecide={(decision) => {
                  decide(repoId, path, { [index]: decision });
                }}
              />
            </div>
          ),
        )}
      </div>
    </>
  );
}
