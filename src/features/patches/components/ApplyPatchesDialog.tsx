import { open } from "@tauri-apps/plugin-dialog";
import { FileUpIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Choice } from "@/shared/components/Choice";
import { InlineError } from "@/shared/components/InlineError";
import type { ApplyModeDto, PatchFileDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useApplyPatches, usePatchCheck } from "../api/patches";
import { allMailboxes, applyToast, mailCount } from "../lib/patches";
import { PatchCheckView } from "./PatchCheckView";

const PATCH_FILTERS = [
  { name: "Patches", extensions: ["patch", "diff", "mbox", "eml"] },
  { name: "All files", extensions: ["*"] },
];

async function choosePatchFiles(): Promise<string[] | null> {
  try {
    const chosen = await open({
      multiple: true,
      title: "Choose patch files",
      filters: PATCH_FILTERS,
    });
    if (chosen === null) return null;
    return Array.isArray(chosen) ? chosen : [chosen];
  } catch (error) {
    toast.error("Could not show the file picker", { description: String(error) });
    return null;
  }
}

function showToast(outcome: ReturnType<typeof applyToast>): void {
  const { title, description, tone } = outcome;
  if (tone === "warning") toast.warning(title, { description });
  else if (tone === "info") toast.info(title, { description });
  else toast.success(title, { description });
}

/**
 * Applying patch files: choose them, see their mails and whether they apply (read again as the
 * files change), then make commits from mails (git am) or only change the files (git apply).
 */
export function ApplyPatchesDialog({ repoId, onClose }: { repoId: number; onClose: () => void }) {
  const id = useId();
  const [paths, setPaths] = useState<string[]>([]);
  const [chosenMode, setChosenMode] = useState<ApplyModeDto | null>(null);
  // The last check (kept while the next one runs) says whether they are mails, which can
  // become commits; before the first one, assume they are.
  const [lastFiles, setLastFiles] = useState<readonly PatchFileDto[] | undefined>(undefined);
  const commitsPossible = lastFiles === undefined || allMailboxes(lastFiles);
  const mode: ApplyModeDto = commitsPossible ? (chosenMode ?? "commits") : "files";
  const check = usePatchCheck(repoId, paths, mode);
  const files = check.data?.files;
  if (files !== undefined && files !== lastFiles) setLastFiles(files);
  const apply = useApplyPatches(repoId);
  const current = check.data && !check.isPlaceholderData ? check.data : undefined;
  const blocked = !current || current.fit.kind === "fails" || apply.isPending;

  const choose = async () => {
    const chosen = await choosePatchFiles();
    if (chosen === null || chosen.length === 0) return;
    setChosenMode(null);
    setLastFiles(undefined);
    setPaths(chosen);
  };

  const submit = () => {
    const commits = files ? mailCount(files) : 0;
    apply.mutate(
      { paths, mode },
      {
        onSuccess: (outcome) => {
          showToast(applyToast(outcome, commits));
          onClose();
        },
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
      <DialogContent className="max-w-xl">
        <form
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Apply patches</DialogTitle>
            <DialogDescription>
              Patch files apply in the order of their names (0001-…, 0002-…). They are checked
              first: nothing changes until you choose Apply.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => void choose()}>
              <FileUpIcon aria-hidden />
              {paths.length > 0 ? "Choose other files…" : "Choose patch files…"}
            </Button>
          </div>
          {paths.length > 0 && check.isPending ? (
            <p className="text-sm text-muted-foreground">Checking the patches…</p>
          ) : null}
          {check.error ? <InlineError error={check.error} /> : null}
          {check.data ? <PatchCheckView check={check.data} mode={mode} /> : null}
          {paths.length > 0 ? (
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1 font-medium">How</legend>
              <Choice
                id={`${id}-commits`}
                type="radio"
                name={`${id}-mode`}
                checked={mode === "commits"}
                disabled={!commitsPossible}
                onChange={() => {
                  setChosenMode("commits");
                }}
                label="Make commits from them"
                detail={
                  commitsPossible
                    ? "Each mail becomes a commit with its message and author (git am)."
                    : "Only mails (made by Create patches or git format-patch) can become commits."
                }
              />
              <Choice
                id={`${id}-files`}
                type="radio"
                name={`${id}-mode`}
                checked={mode === "files"}
                onChange={() => {
                  setChosenMode("files");
                }}
                label="Only change the files"
                detail="Review the changes and commit them yourself (git apply)."
              />
            </fieldset>
          ) : null}
          {apply.error ? <InlineError error={apply.error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={blocked}>
              {apply.isPending ? "Applying…" : "Apply"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
