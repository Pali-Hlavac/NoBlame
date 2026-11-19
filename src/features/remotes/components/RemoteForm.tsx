import { useId, useState } from "react";
import { toast } from "sonner";

import { startFetch, startJob } from "@/features/jobs";
import { useRepositoryPath } from "@/features/repositories";
import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";

import { useAddRemote } from "../api/remotes";
import { remoteNameProblem, urlProblem } from "../lib/remotes";
import { Checkbox, FIELD } from "./form";

interface RemoteFormProps {
  repoId: number;
  /** Names of the remotes there are (a new name must differ). */
  taken: readonly string[];
  onAdded: (name: string) => void;
  /** Hides the Back button when undefined (nothing to go back to). */
  onCancel?: () => void;
}

/** Adding a remote (and fetching it); the editor changes everything else. */
export function RemoteForm({ repoId, taken, onAdded, onCancel }: RemoteFormProps) {
  const id = useId();
  const path = useRepositoryPath(repoId);
  const add = useAddRemote(repoId);
  const [name, setName] = useState(taken.includes("origin") ? "" : "origin");
  const [url, setUrl] = useState("");
  const [fetchNow, setFetchNow] = useState(true);
  const trimmed = name.trim();
  const problem = remoteNameProblem(trimmed, taken) ?? urlProblem(url);

  const submit = () => {
    if (problem !== null) return;
    add.mutate(
      { name: trimmed, url: url.trim() },
      {
        onSuccess: () => {
          toast.success(`Added the remote ${trimmed}`);
          if (fetchNow && path !== undefined) {
            startJob(
              startFetch({ path, target: { type: "remote", name: trimmed }, prune: false }),
              "fetch",
            );
          }
          onAdded(trimmed);
        },
      },
    );
  };

  return (
    <form
      className="flex min-w-0 flex-col gap-3"
      aria-label="Add a remote"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h3 className="text-sm font-semibold">Add a remote</h3>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">
          Name
        </label>
        <input
          id={`${id}-name`}
          value={name}
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} font-mono`}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <label htmlFor={`${id}-url`} className="text-sm font-medium">
          URL
        </label>
        <input
          id={`${id}-url`}
          value={url}
          placeholder="https://… or git@host:owner/repo.git"
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} font-mono`}
          onChange={(event) => {
            setUrl(event.target.value);
          }}
        />
      </div>
      <Checkbox checked={fetchNow} onChange={setFetchNow}>
        Fetch its branches now
      </Checkbox>
      {problem && (name !== "" || url !== "") && (
        <p className="text-xs text-destructive">{problem}</p>
      )}
      {add.error ? <InlineError error={add.error} /> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Back
          </Button>
        ) : null}
        <Button type="submit" disabled={problem !== null || add.isPending}>
          {add.isPending ? "Adding…" : "Add remote"}
        </Button>
      </div>
    </form>
  );
}
