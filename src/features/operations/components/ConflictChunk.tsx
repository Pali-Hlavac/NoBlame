import { useState } from "react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

import { HOW_WORDS, type ConflictChunk as Conflict, textFor } from "../lib/mergeView";
import type { Decision, DecisionHow } from "../store/mergeView";
import { Editor, Lines } from "./MergeText";

interface ConflictChunkProps {
  conflict: Conflict;
  /** 1-based number of this conflict, and how many there are. */
  number: number;
  total: number;
  decision: Decision | undefined;
  names: { ours: string; theirs: string };
  showBase: boolean;
  onDecide: (decision: Decision | undefined) => void;
}

/** One conflict: both versions side by side with the ways to decide it, or what was decided. */
export function ConflictChunk(props: ConflictChunkProps) {
  const { conflict, decision, names, onDecide } = props;
  const [editing, setEditing] = useState<string | null>(null);
  const take = (how: DecisionHow) => {
    onDecide({ how, text: textFor(how, conflict) });
  };
  const title = `Conflict ${String(props.number)} of ${String(props.total)}`;

  return (
    <section
      aria-label={title}
      data-conflict={decision ? "decided" : "open"}
      className={cn("my-1 rounded-md border", decision ? "border-border" : "border-warning")}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/60 px-2 py-1 text-xs">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">
          {decision ? `Decided: ${HOW_WORDS[decision.how]}` : "Not decided yet"}
        </span>
        <span className="flex-1" />
        {decision && editing === null ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6"
              onClick={() => {
                setEditing(decision.text);
              }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6"
              onClick={() => {
                onDecide(undefined);
              }}
            >
              Undo
            </Button>
          </>
        ) : null}
      </header>
      {editing !== null ? (
        <Editor
          text={editing}
          label={`Merged lines of ${title.toLowerCase()}`}
          onChange={setEditing}
          onDone={() => {
            onDecide({ how: "edited", text: editing });
            setEditing(null);
          }}
          onCancel={() => {
            setEditing(null);
          }}
        />
      ) : decision ? (
        <Lines text={decision.text} />
      ) : (
        <>
          <div
            className={cn(
              "grid divide-x divide-border",
              props.showBase ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            <Side label={`Ours: ${names.ours}`} text={conflict.ours} tone="ours" />
            {props.showBase ? (
              <Side label="Base (before both changes)" text={conflict.base} tone="base" />
            ) : null}
            <Side label={`Theirs: ${names.theirs}`} text={conflict.theirs} tone="theirs" />
          </div>
          <div className="flex flex-wrap gap-1 border-t border-border px-2 py-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                take("ours");
              }}
            >
              Use ours
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                take("theirs");
              }}
            >
              Use theirs
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                take("oursThenTheirs");
              }}
            >
              Ours, then theirs
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                take("theirsThenOurs");
              }}
            >
              Theirs, then ours
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                setEditing(textFor("edited", conflict));
              }}
            >
              Edit…
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

const TONES = {
  ours: "border-l-4 border-l-merge-ours bg-merge-ours/10",
  theirs: "border-l-4 border-l-merge-theirs bg-merge-theirs/10",
  base: "bg-muted/40",
} as const;

function Side({ label, text, tone }: { label: string; text: string; tone: keyof typeof TONES }) {
  return (
    <div className={cn("min-w-0", TONES[tone])}>
      <div className="truncate px-2 pt-1 text-xs font-medium text-muted-foreground" title={label}>
        {label}
      </div>
      <Lines text={text} />
    </div>
  );
}
