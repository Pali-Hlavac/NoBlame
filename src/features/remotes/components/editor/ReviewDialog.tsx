import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

interface ReviewDialogProps {
  remote: string;
  /** The commands that will run, in order, secrets hidden. */
  commands: readonly string[];
  pending: boolean;
  error: unknown;
  onSave: () => void;
  onClose: () => void;
}

/** The changes as the commands that make them, before anything is written. */
export function ReviewDialog({
  remote,
  commands,
  pending,
  error,
  onSave,
  onClose,
}: ReviewDialogProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save the changes to {remote}?</DialogTitle>
          <DialogDescription>
            These commands run in this repository, in this order. If one fails, the ones before it
            are undone, so the settings stay as they are now.
          </DialogDescription>
        </DialogHeader>
        <ol
          aria-label="Commands"
          className="max-h-72 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs"
        >
          {commands.map((command, index) => (
            // Two changes can run the same command text: the position is the identity.
            <li key={index} className="py-0.5 break-all">
              {command}
            </li>
          ))}
        </ol>
        {error ? <InlineError error={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Back
          </Button>
          <Button disabled={pending} onClick={onSave}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
