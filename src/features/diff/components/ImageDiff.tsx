import { useState } from "react";

import { InlineError } from "@/shared/components/InlineError";
import { LoadingState } from "@/shared/components/LoadingState";
import type { FileDiffDto } from "@/shared/ipc/bindings";

import { useFileContents } from "../api/contents";
import type { DiffFile } from "../lib/diffFile";
import { formatBytes } from "../lib/format";
import { objectUrlFor } from "../lib/objectUrls";

/** A checkerboard behind the image, so transparent parts are visible. */
const CHECKERBOARD =
  "bg-[conic-gradient(var(--muted)_25%,transparent_0_50%,var(--muted)_0_75%,transparent_0)] bg-size-[16px_16px]";

interface ImagePaneProps {
  repoId: number;
  blobId: string | null;
  /** Set when the image is the working tree file at this path. */
  worktreePath?: string;
  type: string;
  /** "Before" or "After". */
  label: string;
  /** Shown when the file is absent on this side. */
  absent: string;
  path: string;
  size: number;
}

/** One image with its size and pixel dimensions, on a checkerboard. */
export function ImagePane({
  repoId,
  blobId,
  worktreePath,
  type,
  label,
  absent,
  path,
  size,
}: ImagePaneProps) {
  const contents = useFileContents(repoId, blobId, worktreePath);
  const url = contents.data && objectUrlFor(contents.data, type);
  const [pixels, setPixels] = useState<string>();
  let body;
  if (blobId === null) {
    body = <p className="text-sm text-muted-foreground">{absent}</p>;
  } else if (contents.error) {
    body = <InlineError error={contents.error} />;
  } else if (!url) {
    body = <LoadingState label="Loading image…" />;
  } else {
    body = (
      <img
        src={url}
        alt={`${label}: ${path}`}
        className="max-h-full max-w-full object-contain"
        onLoad={(event) => {
          const image = event.currentTarget;
          setPixels(`${image.naturalWidth} × ${image.naturalHeight} px`);
        }}
      />
    );
  }
  return (
    <figure className="flex min-h-48 min-w-48 flex-1 flex-col gap-1.5">
      <figcaption className="text-xs text-muted-foreground">
        {label}
        {blobId !== null && ` · ${formatBytes(size)}`}
        {pixels && ` · ${pixels}`}
      </figcaption>
      <div
        className={`flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded border border-border p-2 ${CHECKERBOARD}`}
      >
        {body}
      </div>
    </figure>
  );
}

interface ImageDiffProps {
  repoId: number;
  file: DiffFile;
  diff: FileDiffDto;
  /** MIME type from the file name. */
  type: string;
}

/** An image file before and after the change, side by side (above each other when narrow). */
export function ImageDiff({ repoId, file, diff, type }: ImageDiffProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-wrap gap-3 overflow-auto p-3">
      <ImagePane
        repoId={repoId}
        blobId={file.oldId}
        type={type}
        label="Before"
        absent="The image did not exist before."
        path={file.previousPath ?? file.path}
        size={Number(diff.oldSize)}
      />
      <ImagePane
        repoId={repoId}
        blobId={file.newId}
        worktreePath={file.worktree ? file.path : undefined}
        type={type}
        label="After"
        absent="The image was removed."
        path={file.path}
        size={Number(diff.newSize)}
      />
    </div>
  );
}
