import { FolderPlusIcon } from "lucide-react";

import { GraphView } from "@/features/graph";
import type { RepositoryTab } from "@/features/workspace";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";
import { KIND_ICON_CLASSES } from "@/shared/lib/workKinds";

import { useRepositorySession } from "../api/session";
import { useCreateRepository } from "../hooks/useOpenRepository";
import { CommitGraphNotice } from "./CommitGraphNotice";
import { RepositoryHeader } from "./RepositoryHeader";

/** One repository tab: header, commit-graph offer and the commit graph. */
export function RepositoryView({ tab }: { tab: RepositoryTab }) {
  const session = useRepositorySession(tab.path);
  const create = useCreateRepository();

  if (session.isPending) return <LoadingState label="Opening repository…" className="h-full" />;
  if (session.error) {
    const notARepository = toIpcError(session.error).code === "NOT_A_REPOSITORY";
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <ErrorState
          error={session.error}
          title={`Could not open ${tab.title}`}
          onRetry={() => void session.refetch()}
        />
        {notARepository && (
          <Button
            variant="outline"
            size="sm"
            disabled={create.pending}
            onClick={() => {
              void create.create(tab.path).then(() => session.refetch());
            }}
          >
            <FolderPlusIcon className={KIND_ICON_CLASSES.repositories} aria-hidden />
            Create a repository here
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <RepositoryHeader summary={session.data} />
      <CommitGraphNotice summary={session.data} tabPath={tab.path} />
      <div className="min-h-0 flex-1">
        <GraphView
          repoId={session.data.id}
          repoPath={tab.path}
          hasWorkingTree={session.data.kind !== "bare"}
        />
      </div>
    </div>
  );
}
