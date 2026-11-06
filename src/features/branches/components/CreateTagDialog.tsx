import { useId, useState } from "react";
import { toast } from "sonner";

import { useCreateTag } from "../api/branches";
import { newNameProblem } from "../lib/names";
import type { StartPoint } from "../store/dialog";
import { NameDialog } from "./NameDialog";
import { useRefNames } from "../hooks/useRefNames";

interface CreateTagDialogProps {
  repoId: number;
  target: StartPoint;
  onClose: () => void;
}

/** “Create a tag here”: a name, and a message that makes it annotated. */
export function CreateTagDialog({ repoId, target, onClose }: CreateTagDialogProps) {
  const id = useId();
  const names = useRefNames(repoId);
  const create = useCreateTag(repoId);
  const [message, setMessage] = useState("");
  return (
    <NameDialog
      title="Create a tag"
      description={<>Marks {target.label}.</>}
      label="Tag name"
      initialName=""
      problemOf={(name) => newNameProblem(name, names.tags, "tag")}
      submitLabel="Create"
      pendingLabel="Creating…"
      pending={create.isPending}
      error={create.error}
      onClose={onClose}
      onSubmit={(name) => {
        const text = message.trim();
        create.mutate(
          { name, target: target.revision, message: text === "" ? null : text },
          {
            onSuccess: () => {
              toast.success(`Created the tag ${name}`);
              onClose();
            },
          },
        );
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-message`} className="text-sm font-medium">
          Message <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id={`${id}-message`}
          value={message}
          rows={4}
          aria-describedby={`${id}-message-help`}
          className="resize-none rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => {
            setMessage(event.target.value);
          }}
        />
        <p id={`${id}-message-help`} className="text-xs text-muted-foreground">
          With a message the tag is annotated: it records who made it and when, and Git signs it if
          your settings say so. Without one it is a lightweight tag, only a name.
        </p>
      </div>
    </NameDialog>
  );
}
