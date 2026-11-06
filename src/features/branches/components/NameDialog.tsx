import type { ReactNode } from "react";
import { useId, useState } from "react";

import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

interface NameDialogProps {
  title: string;
  description: ReactNode;
  /** Label of the name field (“Branch name”). */
  label: string;
  /** The name the field starts with (selected, so typing replaces it). */
  initialName: string;
  /** Why a name cannot be used, or `null`; shown once something was typed. */
  problemOf: (name: string) => string | null;
  /** Say at once what is wrong with the name the field starts with (a suggested name). */
  checkInitialName?: boolean;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** The failed attempt's error, shown with git's words. */
  error: unknown;
  onSubmit: (name: string) => void;
  onClose: () => void;
  /** More fields under the name (options, a message). */
  children?: ReactNode;
}

/** A dialog asking for a new branch or tag name, checked as it is typed. */
export function NameDialog(props: NameDialogProps) {
  const id = useId();
  const [name, setName] = useState(props.initialName);
  const [touched, setTouched] = useState(false);
  const trimmed = name.trim();
  const problem = props.problemOf(trimmed);
  const shownProblem = touched || props.checkInitialName ? problem : null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (!problem && !props.pending) props.onSubmit(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-name`} className="text-sm font-medium">
              {props.label}
            </label>
            <input
              id={`${id}-name`}
              value={name}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={shownProblem !== null}
              aria-describedby={shownProblem ? `${id}-problem` : undefined}
              className="h-8 rounded-md border border-border bg-background px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
              onFocus={(event) => {
                event.currentTarget.select();
              }}
              onChange={(event) => {
                setName(event.target.value);
                setTouched(true);
              }}
            />
            {shownProblem && (
              <p id={`${id}-problem`} className="text-xs text-destructive">
                {shownProblem}
              </p>
            )}
          </div>
          {props.children}
          {props.error ? <InlineError error={props.error} /> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={props.onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={props.pending || problem !== null}>
              {props.pending ? props.pendingLabel : props.submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A checkbox row inside a dialog. */
export function DialogCheckbox(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        checked={props.checked}
        onChange={(event) => {
          props.onChange(event.target.checked);
        }}
      />
      {props.children}
    </label>
  );
}
