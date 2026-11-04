import { useId, useState } from "react";
import { toast } from "sonner";

import { useIgnoreFiles, useIgnorePreview } from "@/features/working-tree";
import { useSettledValue } from "@/shared/hooks/useSettledValue";
import type { IgnoreFileDto } from "@/shared/ipc/bindings";
import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { ignoreChoices } from "../lib/ignore";

/** The preview waits this long after the last key press. */
const PREVIEW_DELAY_MS = 250;

const IGNORE_FILES: Record<IgnoreFileDto, { name: string; detail: string }> = {
  shared: { name: ".gitignore", detail: "shared with everyone once you commit it" },
  local: { name: ".git/info/exclude", detail: "only in this clone, never committed" },
};

const RADIO_CLASS =
  "size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

interface IgnoreDialogProps {
  repoId: number;
  /** The untracked file or folder (ending in `/`) the dialog was opened for. */
  path: string;
  onClose: () => void;
}

/**
 * "Ignore": a pattern for an untracked file (ready-made or typed), the ignore file it goes to, and
 * the files listed now that it would hide. Mount it with `key={path}` so each file starts afresh.
 */
export function IgnoreDialog({ repoId, path, onClose }: IgnoreDialogProps) {
  const id = useId();
  const choices = ignoreChoices(path);
  const [pattern, setPattern] = useState(() => choices[0]?.pattern ?? "");
  const [file, setFile] = useState<IgnoreFileDto>("shared");
  const settled = useSettledValue(pattern, PREVIEW_DELAY_MS);
  const preview = useIgnorePreview(repoId, settled, settled.trim() !== "");
  const ignore = useIgnoreFiles(repoId);
  const target = IGNORE_FILES[file];

  const submit = (): void => {
    ignore.mutate(
      { pattern, file },
      {
        onSuccess: (added) => {
          toast.success(added ? `Added to ${target.name}` : `Already in ${target.name}`, {
            description: pattern,
          });
          onClose();
        },
      },
    );
  };

  let hidden;
  if (preview.error && !preview.isFetching) {
    hidden = <InlineError error={preview.error} />;
  } else if (!preview.data) {
    hidden = <p className="text-muted-foreground">Looking for matching files…</p>;
  } else if (preview.data.total === 0) {
    hidden = <p className="text-muted-foreground">No file listed now matches this pattern.</p>;
  } else {
    const { total, files } = preview.data;
    hidden = (
      <>
        <p>
          Hides {total.toLocaleString()} {total === 1 ? "file" : "files"} listed now
          {total > files.length && ` (first ${files.length.toLocaleString()} shown)`}:
        </p>
        <ul aria-label="Files it hides" className="max-h-28 overflow-auto font-mono text-xs">
          {files.map((name) => (
            <li key={name} className="truncate" title={name}>
              {name}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ignore {path}</DialogTitle>
          <DialogDescription>
            Git stops listing untracked files that match the pattern. Files it already tracks stay
            tracked.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 font-medium">What to ignore</legend>
          {choices.map((choice) => (
            <label key={choice.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${id}-choice`}
                className={RADIO_CLASS}
                checked={pattern === choice.pattern}
                onChange={() => {
                  setPattern(choice.pattern);
                }}
              />
              <span className="min-w-0 flex-1 truncate">{choice.label}</span>
              <code className="truncate text-xs text-muted-foreground">{choice.pattern}</code>
            </label>
          ))}
        </fieldset>
        <label htmlFor={`${id}-pattern`} className="text-sm font-medium">
          Pattern
        </label>
        <input
          id={`${id}-pattern`}
          value={pattern}
          spellCheck={false}
          className="-mt-2 h-8 rounded-md border border-border bg-background px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => {
            setPattern(event.target.value);
          }}
        />
        <div aria-live="polite" className="flex flex-col gap-1 text-sm">
          {hidden}
        </div>
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 font-medium">Add it to</legend>
          {(Object.keys(IGNORE_FILES) as IgnoreFileDto[]).map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${id}-file`}
                className={RADIO_CLASS}
                checked={file === key}
                onChange={() => {
                  setFile(key);
                }}
              />
              <code className="text-xs">{IGNORE_FILES[key].name}</code>
              <span className="text-muted-foreground">{IGNORE_FILES[key].detail}</span>
            </label>
          ))}
        </fieldset>
        {ignore.error ? <InlineError error={ignore.error} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pattern.trim() === "" || ignore.isPending} onClick={submit}>
            Ignore
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
