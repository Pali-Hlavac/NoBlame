import { BinaryIcon, FileIcon, FileWarningIcon } from "lucide-react";

import { useDiffSettings } from "@/features/settings";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";

import { useFileView, type FileViewRequest } from "../api/view";
import { formatBytes } from "../lib/format";
import { imageType } from "../lib/images";
import { FileLines, type LineGutter } from "./FileLines";
import { ImagePane } from "./ImageDiff";

interface FileContentsProps {
  repoId: number;
  /** The file's blob. */
  blobId: string;
  /** Its path: `.gitattributes`, the language and image types go by it. */
  path: string;
  /** Accessible name of the lines, e.g. "src/main.rs at 1a2b3c4d". */
  label: string;
  /** A column before the line numbers (blame). */
  gutter?: LineGutter;
}

/**
 * One version of a file, whole: its lines with numbers and syntax colours (virtualized and
 * paged like the diff), a picture for images, or why it is not shown.
 */
export function FileContents({ repoId, blobId, path, label, gutter }: FileContentsProps) {
  const [settings] = useDiffSettings();
  const request: FileViewRequest = { repoId, blobId, path, syntax: settings.syntaxHighlighting };
  const view = useFileView(request);
  if (view.error) {
    return (
      <ErrorState
        error={view.error}
        title="Could not read the file"
        onRetry={() => void view.refetch()}
        className="flex-1 justify-center"
      />
    );
  }
  if (!view.data) return <LoadingState label="Reading the file…" className="flex-1" />;
  const size = Number(view.data.newSize);
  const image = imageType(path);
  switch (view.data.content) {
    case "binary":
      return image ? (
        <div className="flex min-h-0 flex-1 overflow-auto p-3">
          <ImagePane
            repoId={repoId}
            blobId={blobId}
            type={image}
            label="Image"
            absent=""
            path={path}
            size={size}
          />
        </div>
      ) : (
        <EmptyState
          icon={BinaryIcon}
          title="Binary file"
          description={`${formatBytes(size)}. Save it to open it in another program.`}
          className="flex-1"
        />
      );
    case "tooLarge":
      return (
        <EmptyState
          icon={FileWarningIcon}
          title="Too large to show"
          description={`${formatBytes(size)}. Files over 64 MB are not shown; save it to open it in another program.`}
          className="flex-1"
        />
      );
    case "text":
      return view.data.rows === 0 ? (
        <EmptyState
          icon={FileIcon}
          title="Empty file"
          description="The file has no contents."
          className="flex-1"
        />
      ) : (
        <FileLines request={request} view={view.data} label={label} gutter={gutter} />
      );
  }
}
