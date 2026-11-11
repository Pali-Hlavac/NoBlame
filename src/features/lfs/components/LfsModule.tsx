import { useQueryClient } from "@tanstack/react-query";
import { DownloadIcon, HardDriveIcon, LockIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { WithActiveRepository } from "@/features/repositories";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import type { LfsFileDto } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { startLfsPull, useLfs, useLockLfsFile } from "../api/lfs";
import { lfsSummary } from "../lib/lfs";
import { LfsLocks } from "./LfsLocks";

/** LFS files listed; the rest are counted (the module is a glance, not a file browser). */
const SHOWN_FILES = 2_000;

function FileRow({ file, onLock }: { file: LfsFileDto; onLock: () => void }) {
  return (
    <li className="group flex items-center gap-2 rounded-md px-2 py-0.5 hover:bg-accent">
      <span className="min-w-0 flex-1 truncate text-sm" title={file.path}>
        {file.path}
      </span>
      {file.hasContent ? null : (
        <span
          className="shrink-0 rounded border border-warning/50 px-1 text-[0.7rem] text-warning"
          title="Only the pointer is in your folder: the content was not downloaded"
        >
          pointer only
        </span>
      )}
      <span className="shrink-0 text-xs text-muted-foreground">{file.size}</span>
      <Tooltip content={`Lock ${file.path}`}>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Lock ${file.path}`}
          onClick={onLock}
        >
          <LockIcon aria-hidden />
        </Button>
      </Tooltip>
    </li>
  );
}

/** A repository's Git LFS files, whether each has its content, downloading, and the locks. */
export function Lfs({ repoId, path }: { repoId: number; path: string }) {
  const lfs = useLfs(repoId);
  const lock = useLockLfsFile(repoId);
  const queryClient = useQueryClient();
  const files = lfs.data?.files ?? [];
  const pointers = files.filter((file) => !file.hasContent).length;

  const lockFile = (file: string) => {
    lock.mutate(file, {
      onSuccess: () => toast.success(`Locked ${file}`),
      onError: (error) => {
        const { message, hint } = toIpcError(error);
        toast.error(`Could not lock ${file}`, {
          description: hint ? `${message}\n\n${hint}` : message,
          classNames: { description: "whitespace-pre-line" },
        });
      },
    });
  };

  let body;
  if (lfs.error) {
    body = (
      <ErrorState
        error={lfs.error}
        title="Could not read the LFS files"
        onRetry={() => void lfs.refetch()}
        className="flex-1 justify-center"
      />
    );
  } else if (!lfs.data) {
    body = <LoadingState label="Reading the LFS files…" className="flex-1" />;
  } else if (lfs.data.version === null) {
    body = (
      <EmptyState
        icon={HardDriveIcon}
        title="Git LFS is not installed"
        description="Git LFS keeps large files outside the history. Install it from git-lfs.com, then refresh."
        className="flex-1"
      />
    );
  } else if (files.length === 0) {
    body = (
      <EmptyState
        icon={HardDriveIcon}
        title="No files in Git LFS"
        description="Files Git LFS tracks (git lfs track, in .gitattributes) appear here, with whether their content is downloaded."
        className="flex-1"
      />
    );
  } else {
    body = (
      <div className="min-h-0 flex-1 overflow-auto p-1">
        <p className="px-2 py-1 text-xs text-muted-foreground">{lfsSummary(lfs.data)}</p>
        <ul aria-label="LFS files">
          {files.slice(0, SHOWN_FILES).map((file) => (
            <FileRow
              key={file.path}
              file={file}
              onLock={() => {
                lockFile(file.path);
              }}
            />
          ))}
        </ul>
        {lfs.data.total > SHOWN_FILES ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            and {(lfs.data.total - SHOWN_FILES).toLocaleString()} more
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b border-border px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6"
          disabled={pointers === 0}
          title="Download the contents of the files that are only pointers (git lfs pull)"
          onClick={() => {
            startLfsPull(queryClient, repoId, path);
          }}
        >
          <DownloadIcon aria-hidden />
          Download contents
        </Button>
        <Tooltip content="Refresh the LFS files">
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Refresh the LFS files"
            disabled={lfs.isFetching}
            onClick={() => void lfs.refetch()}
          >
            <RefreshCwIcon aria-hidden />
          </Button>
        </Tooltip>
      </div>
      {body}
      {lfs.data?.version ? <LfsLocks repoId={repoId} /> : null}
    </div>
  );
}

/** Git LFS module: the active repository's LFS files and locks. */
export function LfsModule() {
  return (
    <WithActiveRepository>
      {(summary) => <Lfs repoId={summary.id} path={summary.path} />}
    </WithActiveRepository>
  );
}
