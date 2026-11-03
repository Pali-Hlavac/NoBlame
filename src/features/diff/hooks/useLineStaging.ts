/**
 * Staging, unstaging and discarding lines from a working tree diff: which changed lines are
 * chosen, and running an action on them (or on a hunk). Rows read it from `LineStagingContext`.
 */
import { createContext, useRef, useState, type RefObject } from "react";

import { useLineChange, type LineAction, type WorkingTreeKind } from "@/features/working-tree";

import type { DiffFile } from "../lib/diffFile";
import type { ChosenLines, LineKey } from "../lib/lineSelection";

export interface LineStaging {
  /** Working tree changes (stage, discard) or staged ones (unstage). */
  kind: WorkingTreeKind;
  selected: ReadonlySet<LineKey>;
  /** Toggles `keys`, or adds them all (a Shift+click range). */
  choose: (keys: readonly LineKey[], mode: "toggle" | "add") => void;
  clear: () => void;
  /** Row of the last line clicked, where a Shift+click range starts. */
  anchor: RefObject<number | null>;
  /** Runs `action` on `lines`; `what` names them for the confirmation of a discard. */
  run: (action: LineAction, lines: ChosenLines, what: string) => void;
  busy: boolean;
}

export const LineStagingContext = createContext<LineStaging | null>(null);

/** A discard waiting for the user to confirm it. */
export interface PendingDiscard {
  lines: ChosenLines;
  what: string;
}

const NOTHING: ReadonlySet<LineKey> = new Set();

/**
 * The line staging of `file`'s diff, or `null` when its lines cannot be changed (no `kind`, or
 * the new version is gone). The choice is forgotten when the file's versions change.
 */
export function useLineStaging(repoId: number, file: DiffFile, kind: WorkingTreeKind | undefined) {
  const identity = `${file.path}\0${file.oldId ?? ""}\0${file.newId ?? ""}`;
  const [chosen, setChosen] = useState({ identity, keys: NOTHING });
  const [pending, setPending] = useState<PendingDiscard | null>(null);
  const anchor = useRef<number | null>(null);
  const change = useLineChange(repoId);
  const selected = chosen.identity === identity ? chosen.keys : NOTHING;

  const clear = (): void => {
    setChosen({ identity, keys: NOTHING });
    anchor.current = null;
  };
  const execute = (action: LineAction, lines: ChosenLines): void => {
    if (file.newId === null) return;
    const request = { path: file.path, oldId: file.oldId, newId: file.newId, ...lines };
    change.mutate({ action, request }, { onSuccess: clear });
  };

  const staging: LineStaging | null =
    kind === undefined || file.newId === null
      ? null
      : {
          kind,
          selected,
          choose: (keys, mode) => {
            const next = new Set(selected);
            for (const key of keys) {
              if (mode === "toggle" && next.has(key)) next.delete(key);
              else next.add(key);
            }
            setChosen({ identity, keys: next });
          },
          clear,
          anchor,
          run: (action, lines, what) => {
            if (action === "discard") setPending({ lines, what });
            else execute(action, lines);
          },
          busy: change.isPending,
        };

  return {
    staging,
    pending,
    confirmDiscard: () => {
      if (pending) execute("discard", pending.lines);
      setPending(null);
    },
    cancelDiscard: () => {
      setPending(null);
    },
  };
}

/**
 * Clicking the line numbers of row `index` (whose changed line is `key`): toggles that line, or
 * with Shift adds every changed line from the row clicked last. `keysOfRow` reads the loaded
 * rows in between.
 */
export function clickLine(
  staging: LineStaging,
  index: number,
  key: LineKey,
  extend: boolean,
  keysOfRow: (index: number) => readonly LineKey[],
): void {
  const from = staging.anchor.current;
  if (extend && from !== null) {
    const keys: LineKey[] = [];
    for (let row = Math.min(from, index); row <= Math.max(from, index); row++) {
      keys.push(...keysOfRow(row));
    }
    staging.choose(keys, "add");
  } else {
    staging.choose([key], "toggle");
  }
  staging.anchor.current = index;
}
