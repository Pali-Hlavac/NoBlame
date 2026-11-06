import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";

import { events, type CredentialRequestDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { answerCredential, credentialKeys, useCredentialRequests } from "../api/credentials";
import { repositoryName, wordingOf } from "../lib/wording";

/** Reads the list again whenever a prompt opens or closes. */
function useCredentialEvents(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: credentialKeys.list });
    const listeners = [
      events.credentialRequested.listen(refresh),
      events.credentialClosed.listen(refresh),
    ];
    return () => {
      for (const listener of listeners) {
        void listener.then((stop) => {
          stop();
        });
      }
    };
  }, [queryClient]);
}

function useAnswer(request: CredentialRequestDto) {
  const queryClient = useQueryClient();
  return (answer: string | null) => {
    void answerCredential(request.id, answer).finally(() => {
      void queryClient.invalidateQueries({ queryKey: credentialKeys.list });
    });
  };
}

/** ssh does not know the server yet: show its fingerprint, then connect or not. */
function HostKeyDialog({ request }: { request: CredentialRequestDto }) {
  const answer = useAnswer(request);
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Unknown server</DialogTitle>
        <DialogDescription>
          {request.jobTitle} in {repositoryName(request.repoPath)} connects to a server ssh has not
          seen before. Connect only if the fingerprint is the one the server's owner publishes.
        </DialogDescription>
      </DialogHeader>
      <pre className="rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
        {request.prompt}
      </pre>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            answer("no");
          }}
        >
          Don't connect
        </Button>
        <Button
          onClick={() => {
            answer("yes");
          }}
        >
          Trust and connect
        </Button>
      </div>
    </DialogContent>
  );
}

/** A user name, password, passphrase or other answer, typed. */
function AnswerDialog({ request }: { request: CredentialRequestDto }) {
  const id = useId();
  const [value, setValue] = useState("");
  const answer = useAnswer(request);
  const kind = request.kind === "hostKey" ? "other" : request.kind;
  const wording = wordingOf(kind);
  return (
    <DialogContent className="max-w-md">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          answer(value);
        }}
      >
        <DialogHeader>
          <DialogTitle>{wording.title}</DialogTitle>
          <DialogDescription>
            {request.jobTitle} in {repositoryName(request.repoPath)}. NoBlame passes this to Git and
            does not keep it; Git may save it with your credential helper.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm break-words">{request.prompt}</p>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-answer`} className="text-sm font-medium">
            {wording.label}
          </label>
          <input
            id={`${id}-answer`}
            type={request.secret ? "password" : "text"}
            value={value}
            autoComplete="off"
            spellCheck={false}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              answer(null);
            }}
          >
            Cancel
          </Button>
          <Button type="submit">{wording.submit}</Button>
        </div>
      </form>
    </DialogContent>
  );
}

/**
 * Shows the oldest credential prompt of a background job (mounted once, in the main window).
 * Closing the dialog cancels the prompt, and git fails with its own message.
 */
export function CredentialPrompt() {
  useCredentialEvents();
  const request = useCredentialRequests().data?.[0];
  if (!request) return null;
  return (
    <Dialog
      // A new prompt starts afresh (an empty field).
      key={request.id}
      open
      onOpenChange={(open) => {
        if (!open) void answerCredential(request.id, request.kind === "hostKey" ? "no" : null);
      }}
    >
      {request.kind === "hostKey" ? (
        <HostKeyDialog request={request} />
      ) : (
        <AnswerDialog request={request} />
      )}
    </Dialog>
  );
}
