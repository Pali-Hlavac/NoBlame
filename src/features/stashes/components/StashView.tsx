import { ArchiveIcon, MousePointerClickIcon } from "lucide-react";
import { useEffect } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { FileDiffView } from "@/features/diff";
import { WithActiveRepository } from "@/features/repositories";
import { STASH_TAB, useTabsStore } from "@/features/workspace";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useStashFiles, useStashes } from "../api/stashes";
import { stashFileList, stashName } from "../lib/files";
import { chooseStashFiles, showStashFile, useShownStash } from "../store/shown";
import { CheckedFiles } from "./CheckedFiles";
import { StashHeader } from "./StashHeader";

/** Panels sized by the layout must not scroll themselves (fractional display scaling). */
const PANEL_STYLE = { overflow: "hidden" } as const;

interface StashBodyProps {
  repoId: number;
  repoPath: string;
}

/** The shown stash of one repository: its actions, its files and the chosen file's diff. */
export function StashBody({ repoId, repoPath }: StashBodyProps) {
  const shown = useShownStash(repoPath);
  const stashes = useStashes(repoId);
  const stash = stashes.data?.find((entry) => entry.id === shown?.id);
  const files = useStashFiles(repoId, stash?.id);

  useEffect(() => {
    const title = stash ? `Stash: ${stashName(stash)}` : "Stash";
    useTabsStore.getState().setTitle(STASH_TAB.id, title);
  }, [stash]);

  if (!shown || (stashes.data && !stash)) {
    return (
      <EmptyState
        icon={ArchiveIcon}
        title={shown ? "This stash is gone" : "No stash chosen"}
        description="Choose a stash in the Stashes module to see its files and apply them."
        className="flex-1"
      />
    );
  }
  if (!stash) return <LoadingState label="Reading stashes…" className="flex-1" />;
  if (files.error) {
    return (
      <ErrorState
        error={files.error}
        title="Could not read the stash"
        onRetry={() => void files.refetch()}
        className="flex-1 justify-center"
      />
    );
  }
  if (!files.data) return <LoadingState label="Reading the stash…" className="flex-1" />;

  const list = stashFileList(files.data);
  const file = list.find((entry) => entry.key === shown.file);
  return (
    <>
      <StashHeader
        repoId={repoId}
        repoPath={repoPath}
        stash={stash}
        files={list}
        chosen={shown.chosen}
        listed={files.data}
      />
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel id="stash-files" defaultSize="35%" minSize="160px" style={PANEL_STYLE}>
          <CheckedFiles
            className="h-full"
            label="Files in the stash"
            files={list}
            keyOf={(entry) => entry.key}
            checked={shown.chosen}
            onCheck={(keys, chosen) => {
              chooseStashFiles(repoPath, keys, chosen);
            }}
            shown={shown.file}
            onShow={(entry) => {
              showStashFile(repoPath, entry.key);
            }}
          />
        </Panel>
        <Separator
          aria-label="Resize the file list"
          className="w-px bg-border outline-none hover:bg-primary focus-visible:bg-ring data-[separator=active]:bg-primary"
        />
        <Panel id="stash-diff" minSize="200px" style={PANEL_STYLE}>
          {file ? (
            <FileDiffView repoId={repoId} file={file} />
          ) : (
            <EmptyState
              icon={MousePointerClickIcon}
              title="No file chosen"
              description="Choose a file to see what the stash changed in it."
              className="h-full"
            />
          )}
        </Panel>
      </Group>
    </>
  );
}

/** The Stash tab: the stash chosen in the Stashes module, for the active repository. */
export function StashView() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <WithActiveRepository>
        {(summary, tab) => <StashBody repoId={summary.id} repoPath={tab.path} />}
      </WithActiveRepository>
    </div>
  );
}
