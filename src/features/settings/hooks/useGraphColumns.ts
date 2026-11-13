import type { DateDisplay, GraphColumn, GraphSettings } from "@/shared/ipc/bindings";

import { DEFAULT_GRAPH_COLUMNS, normalizeColumns } from "../lib/graphColumns";
import { useAppSettings, useChangeSettings } from "./useAppSettings";

/** The commit list's columns, date display and message body, with functions that save them. */
export function useGraphColumns(): {
  columns: readonly GraphColumn[];
  dateDisplay: DateDisplay;
  /** The message column shows the rest of the message after the subject. */
  showMessageBody: boolean;
  setColumns: (columns: GraphColumn[]) => void;
  setDateDisplay: (display: DateDisplay) => void;
  setShowMessageBody: (show: boolean) => void;
  resetColumns: () => void;
} {
  const { graph } = useAppSettings();
  const changeSettings = useChangeSettings();
  const save = (
    patch: Partial<Pick<GraphSettings, "columns" | "dateDisplay" | "showMessageBody">>,
  ): void => {
    changeSettings((current) => ({ ...current, graph: { ...current.graph, ...patch } }));
  };
  return {
    columns: normalizeColumns(graph.columns),
    dateDisplay: graph.dateDisplay,
    showMessageBody: graph.showMessageBody,
    setColumns: (columns) => {
      save({ columns: normalizeColumns(columns) });
    },
    setDateDisplay: (dateDisplay) => {
      save({ dateDisplay });
    },
    setShowMessageBody: (showMessageBody) => {
      save({ showMessageBody });
    },
    resetColumns: () => {
      save({ columns: [...DEFAULT_GRAPH_COLUMNS] });
    },
  };
}
