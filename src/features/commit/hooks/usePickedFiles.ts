import { useMemo, useState } from "react";

import type { RowGesture } from "@/shared/components/VirtualList";
import type { WorkingFileDto } from "@/shared/ipc/bindings";

import { NOTHING_PICKED, pick, pickAll, pickedPaths, togglePick } from "../lib/pick";

/** The files chosen in one Commit list (see `lib/pick.ts`) and what changes the choice. */
export interface PickedFiles {
  /** Paths chosen now. */
  chosen: ReadonlySet<string>;
  /** What the keyboard and the menu act on: the chosen files, else the cursor's file. */
  current: WorkingFileDto[];
  /** What a row's button acts on: every chosen file when it is one of several, else itself. */
  actedOn: (file: WorkingFileDto) => WorkingFileDto[];
  /** The cursor reached row `index` with `gesture`. */
  move: (index: number, gesture: RowGesture) => void;
  /** Ctrl+Space. */
  toggleCursor: () => void;
  /** Ctrl+A. */
  chooseAll: () => void;
}

/** Several files chosen at once in `files`, whose cursor (the file shown) is `cursor`. */
export function usePickedFiles(
  files: readonly WorkingFileDto[],
  cursor: string | undefined,
): PickedFiles {
  const [picked, setPicked] = useState(NOTHING_PICKED);
  const paths = useMemo(() => files.map((file) => file.path), [files]);
  const chosen = pickedPaths(picked, paths, cursor);
  const chosenFiles = files.filter((file) => chosen.has(file.path));
  const cursorFile = files.find((file) => file.path === cursor);
  return {
    chosen,
    current: chosenFiles.length > 0 ? chosenFiles : cursorFile ? [cursorFile] : [],
    actedOn: (file) => (chosen.size > 1 && chosen.has(file.path) ? chosenFiles : [file]),
    move: (index, gesture) => {
      setPicked(pick(picked, chosen, paths, index, gesture));
    },
    toggleCursor: () => {
      if (cursor !== undefined) setPicked(togglePick(chosen, cursor));
    },
    chooseAll: () => {
      if (cursor !== undefined) setPicked(pickAll(paths, cursor));
    },
  };
}
