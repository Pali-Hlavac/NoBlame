import { useId, useState } from "react";

import type { StartPoint } from "@/features/graph";
import { Choice } from "@/shared/components/Choice";
import { InlineError } from "@/shared/components/InlineError";
import type { ArchiveFormatDto } from "@/shared/ipc/bindings";
import { folderName } from "@/shared/lib/paths";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { startArchive } from "../api/patches";
import { archiveBaseName } from "../lib/patches";

const FIELD =
  "h-8 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const EXTENSIONS: Record<ArchiveFormatDto, string> = { zip: ".zip", tarGz: ".tar.gz" };

interface ArchiveDialogProps {
  /** The repository's folder. */
  path: string;
  commit: StartPoint;
  /** A tag on the commit, or its short id. */
  name: string;
  onClose: () => void;
}

/**
 * Saving the files of a commit as a zip or tar.gz file, inside a folder or not. The app then
 * asks where, and a job writes it (it can be cancelled).
 */
export function ArchiveDialog({ path, commit, name, onClose }: ArchiveDialogProps) {
  const id = useId();
  const base = archiveBaseName(folderName(path), name);
  const [format, setFormat] = useState<ArchiveFormatDto>("zip");
  const [inFolder, setInFolder] = useState(true);
  const [folder, setFolder] = useState(base);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = () => {
    setPending(true);
    setError(null);
    startArchive({
      path,
      revision: commit.revision,
      label: name,
      format,
      folder: inFolder ? folder : "",
      fileName: `${base}${EXTENSIONS[format]}`,
    }).then(
      (started) => {
        setPending(false);
        if (started) onClose();
      },
      (failure: unknown) => {
        setPending(false);
        setError(failure);
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle className="break-words">Save an archive of {commit.label}</DialogTitle>
            <DialogDescription>
              Its files as they are in that commit, without the history. Submodules&apos; files are
              not included.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium">Format</legend>
            <Choice
              id={`${id}-zip`}
              type="radio"
              name={`${id}-format`}
              checked={format === "zip"}
              onChange={() => {
                setFormat("zip");
              }}
              label="Zip (.zip)"
            />
            <Choice
              id={`${id}-tgz`}
              type="radio"
              name={`${id}-format`}
              checked={format === "tarGz"}
              onChange={() => {
                setFormat("tarGz");
              }}
              label="Tar, gzip-compressed (.tar.gz)"
              detail="Keeps executable bits and symbolic links."
            />
          </fieldset>
          <div className="flex flex-col gap-2 text-sm">
            <Choice
              id={`${id}-in-folder`}
              type="checkbox"
              checked={inFolder}
              onChange={setInFolder}
              label="Put the files in a folder inside the archive"
            />
            {inFolder ? (
              <input
                aria-label="Folder inside the archive"
                value={folder}
                spellCheck={false}
                autoComplete="off"
                className={`${FIELD} ml-6`}
                onChange={(event) => {
                  setFolder(event.target.value);
                }}
              />
            ) : null}
          </div>
          {error ? <InlineError error={error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || (inFolder && folder.trim() === "")}>
              {pending ? "Choosing where…" : "Save…"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
