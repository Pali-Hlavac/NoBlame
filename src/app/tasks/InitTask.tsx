import { CheckCircle2Icon } from "lucide-react";
import { useId, useState } from "react";

import { pickFolder, useFolderState, useInitRepository } from "@/features/repositories";
import { InlineError } from "@/shared/components/InlineError";
import { actionDone } from "@/shared/lib/actionDone";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { initAdvice } from "./initAdvice";
import { OpenInNoBlameButton, TaskDone } from "./TaskDone";

const TONES = {
  info: "text-muted-foreground",
  warning: "text-warning",
  error: "text-destructive",
} as const;

const FIELD =
  "h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The Create repository window (`noblame init <folder>`): the folder (the one given, or
 * another), what is there, and **Create** (`git init`). Then a way to open it.
 */
export function InitTask({ path }: { path: string }) {
  const id = useId();
  const [folder, setFolder] = useState(path);
  const [created, setCreated] = useState<string | null>(null);
  const state = useFolderState(folder);
  const init = useInitRepository();
  const advice = state.data ? initAdvice(state.data) : null;
  const ready = folder.trim() !== "" && state.data !== undefined && !advice?.blocked;

  if (created !== null) {
    return (
      <TaskDone
        title="Created a repository"
        folder={created}
        icon={CheckCircle2Icon}
        onAgain={() => {
          setCreated(null);
        }}
        againLabel="Create another"
      />
    );
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        const target = folder.trim();
        init.mutate(target, {
          onSuccess: () => {
            setCreated(target);
            actionDone("init");
          },
        });
      }}
    >
      <h2 className="text-lg font-semibold">Create a repository</h2>
      <p className="text-sm text-muted-foreground">
        Makes the folder a Git repository (git init), with no commits yet.
      </p>
      <label htmlFor={`${id}-folder`} className="text-sm font-medium">
        Folder
      </label>
      <div className="flex min-w-0 gap-2">
        <input
          id={`${id}-folder`}
          value={folder}
          spellCheck={false}
          autoComplete="off"
          className={FIELD}
          onChange={(event) => {
            setFolder(event.target.value);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void pickFolder("Create a repository in…").then((picked) => {
              if (picked) setFolder(picked);
            });
          }}
        >
          Browse…
        </Button>
      </div>
      {advice ? (
        <p className={cn("text-sm break-words", TONES[advice.tone])}>{advice.text}</p>
      ) : null}
      {state.error ? <InlineError error={state.error} /> : null}
      {init.error ? <InlineError error={init.error} /> : null}
      <div className="flex justify-end gap-2">
        {state.data?.isRepository ? (
          <OpenInNoBlameButton folder={folder.trim()} variant="outline" />
        ) : null}
        <Button type="submit" disabled={!ready || init.isPending}>
          {init.isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </form>
  );
}
