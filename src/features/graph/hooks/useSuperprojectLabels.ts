import { useMemo } from "react";

import { useSuperprojectBranches } from "../api/refs";

/** The superproject's branches recording the commit on a row. */
export interface SuperprojectLabel {
  /** The superproject's folder name (`app`). */
  superproject: string;
  branches: readonly string[];
}

export type SuperprojectLabelOf = (row: number) => SuperprojectLabel | undefined;

/** The last part of a path, `/` or `\` separated. */
function folderName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path;
}

/** In a submodule's graph: which rows the superproject's local branches record. */
export function useSuperprojectLabels(repoId: number): SuperprojectLabelOf {
  const data = useSuperprojectBranches(repoId).data;
  return useMemo(() => {
    const byRow = new Map<number, SuperprojectLabel>();
    if (data) {
      const superproject = folderName(data.superproject);
      for (const label of data.labels) {
        if (label.row !== null) byRow.set(label.row, { superproject, branches: label.branches });
      }
    }
    return (row: number) => byRow.get(row);
  }, [data]);
}
