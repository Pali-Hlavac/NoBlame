import { useId, useState } from "react";
import { toast } from "sonner";

import { startFetch, startJob } from "@/features/jobs";
import { useRepositoryPath } from "@/features/repositories";
import { InlineError } from "@/shared/components/InlineError";
import type { RemoteDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useAddRemote, useEditRemote } from "../api/remotes";
import { remoteNameProblem, urlProblem } from "../lib/remotes";
import { Checkbox, FIELD } from "./form";

interface RemoteFormProps {
  repoId: number;
  /** The remote to edit; adds a new one when undefined. */
  remote?: RemoteDto;
  /** Names of the other remotes (a new name must differ). */
  taken: readonly string[];
  onDone: () => void;
}

/** Adding a remote (and fetching it), or changing a remote's name, URL and push URL. */
export function RemoteForm({ repoId, remote, taken, onDone }: RemoteFormProps) {
  const id = useId();
  const path = useRepositoryPath(repoId);
  const add = useAddRemote(repoId);
  const edit = useEditRemote(repoId);
  const [name, setName] = useState(remote?.name ?? (taken.includes("origin") ? "" : "origin"));
  const [url, setUrl] = useState(remote?.url ?? "");
  const [pushUrl, setPushUrl] = useState(remote?.pushUrl ?? "");
  const [fetchNow, setFetchNow] = useState(true);
  const trimmed = name.trim();
  const problem =
    remoteNameProblem(
      trimmed,
      taken.filter((other) => other !== remote?.name),
    ) ??
    urlProblem(url) ??
    (pushUrl.trim() ? urlProblem(pushUrl) : null);
  const mutation = remote ? edit : add;

  const submit = () => {
    if (problem !== null) return;
    if (!remote) {
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
            onDone();
          },
        },
      );
      return;
    }
    edit.mutate(
      { name: remote.name, newName: trimmed, url: url.trim(), pushUrl: pushUrl.trim() || null },
      {
        onSuccess: () => {
          toast.success(`Saved the remote ${trimmed}`);
          onDone();
        },
      },
    );
  };

  return (
    <form
      className="flex min-w-0 flex-col gap-3"
      aria-label={remote ? `Edit ${remote.name}` : "Add a remote"}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
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
        {remote && (
          <>
            <label htmlFor={`${id}-push`} className="text-sm font-medium">
              Push URL
            </label>
            <input
              id={`${id}-push`}
              value={pushUrl}
              placeholder="The same as URL"
              spellCheck={false}
              autoComplete="off"
              className={`${FIELD} font-mono`}
              onChange={(event) => {
                setPushUrl(event.target.value);
              }}
            />
          </>
        )}
      </div>
      {remote && trimmed !== remote.name && (
        <p className="text-xs text-muted-foreground">
          Renaming moves its remote branches to {trimmed || "the new name"}/…; branches tracking it
          follow.
        </p>
      )}
      {!remote && (
        <Checkbox checked={fetchNow} onChange={setFetchNow}>
          Fetch its branches now
        </Checkbox>
      )}
      {problem && (name !== "" || url !== "") && (
        <p className="text-xs text-destructive">{problem}</p>
      )}
      {mutation.error ? <InlineError error={mutation.error} /> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Back
        </Button>
        <Button type="submit" disabled={problem !== null || mutation.isPending}>
          {mutation.isPending ? (remote ? "Saving…" : "Adding…") : remote ? "Save" : "Add remote"}
        </Button>
      </div>
    </form>
  );
}
