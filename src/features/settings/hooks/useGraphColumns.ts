import type { DateDisplay, GraphColumn } from "@/shared/ipc/bindings";

import { DEFAULT_GRAPH_COLUMNS, normalizeColumns } from "../lib/graphColumns";
import { useAppSettings, useChangeSettings } from "./useAppSettings";

/** The commit list's columns and date display, with functions that save them. */
export function useGraphColumns(): {
  columns: readonly GraphColumn[];
  dateDisplay: DateDisplay;
  setColumns: (columns: GraphColumn[]) => void;
  setDateDisplay: (display: DateDisplay) => void;
  resetColumns: () => void;
} {
  const { graph } = useAppSettings();
  const changeSettings = useChangeSettings();
  const save = (patch: { columns?: GraphColumn[]; dateDisplay?: DateDisplay }): void => {
    changeSettings((current) => ({ ...current, graph: { ...current.graph, ...patch } }));
  };
  return {
    columns: normalizeColumns(graph.columns),
    dateDisplay: graph.dateDisplay,
    setColumns: (columns) => {
      save({ columns: normalizeColumns(columns) });
    },
    setDateDisplay: (dateDisplay) => {
      save({ dateDisplay });
    },
    resetColumns: () => {
      save({ columns: [...DEFAULT_GRAPH_COLUMNS] });
    },
  };
}
