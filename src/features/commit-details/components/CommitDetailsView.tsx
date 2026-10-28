import { CopyIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { RefBadge, shortId } from "@/features/graph";
import { selectRow } from "@/features/selection";
import type { CommitDetailsDto, SignatureDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { formatSignatureDate, splitMessage } from "../lib/format";
import { ContainedIn } from "./ContainedIn";

function copy(text: string, what: string): void {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    (error: unknown) =>
      toast.error(`Could not copy the ${what.toLowerCase()}`, { description: String(error) }),
  );
}

function Person({ signature }: { signature: SignatureDto }) {
  return (
    <span className="min-w-0">
      <span className="block truncate">
        {signature.name} <span className="text-muted-foreground">&lt;{signature.email}&gt;</span>
      </span>
      <span className="block text-muted-foreground tabular-nums">
        {formatSignatureDate(signature.time, signature.offsetMinutes)}
      </span>
    </span>
  );
}

function sameSignature(a: SignatureDto, b: SignatureDto): boolean {
  return a.name === b.name && a.email === b.email && a.time === b.time;
}

function Field({
  label,
  children,
  wrap = true,
}: {
  label: string;
  children: ReactNode;
  wrap?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("flex min-w-0 items-center gap-1", wrap && "flex-wrap")}>{children}</dd>
    </>
  );
}

interface CommitDetailsViewProps {
  details: CommitDetailsDto;
  repoPath: string;
}

/** Message, ids, people, refs and "contained in" of one commit. */
export function CommitDetailsView({ details, repoPath }: CommitDetailsViewProps) {
  const { summary, body } = splitMessage(details.message);
  return (
    <article aria-label={`Commit ${shortId(details.id)}`} className="space-y-3 p-3 text-sm">
      <header className="space-y-1 select-text">
        <h3 className="font-semibold break-words">{summary}</h3>
        {body && (
          <pre className="font-sans break-words whitespace-pre-wrap text-muted-foreground">
            {body}
          </pre>
        )}
      </header>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        <Field label="Commit" wrap={false}>
          <code
            className="min-w-0 flex-1 truncate font-mono text-xs select-text"
            title={details.id}
          >
            {details.id}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Copy commit id"
            onClick={() => {
              copy(details.id, "Commit id");
            }}
          >
            <CopyIcon aria-hidden />
          </Button>
        </Field>
        {details.parents.length > 0 && (
          <Field label={details.parents.length > 1 ? "Parents" : "Parent"}>
            {details.parents.map((parent) => (
              <button
                key={parent.id}
                className="rounded font-mono text-xs text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                title={`Select parent ${parent.id}`}
                onClick={() => {
                  selectRow(repoPath, parent.row);
                }}
              >
                {shortId(parent.id)}
              </button>
            ))}
          </Field>
        )}
        <Field label="Author">
          <Person signature={details.author} />
        </Field>
        {!sameSignature(details.author, details.committer) && (
          <Field label="Committer">
            <Person signature={details.committer} />
          </Field>
        )}
        {details.refs.length > 0 && (
          <Field label="Refs">
            {details.refs.map((label) => (
              <RefBadge key={`${label.kind}:${label.name}`} label={label} />
            ))}
          </Field>
        )}
      </dl>
      <ContainedIn refs={details.containedIn} total={details.containedInTotal} />
    </article>
  );
}
