/** Which settings the editor's search marks: every match, and the one Enter moved to. */
import { createContext, useContext } from "react";

export interface Highlight {
  readonly matched: ReadonlySet<string>;
  readonly active: string | null;
}

export const HighlightContext = createContext<Highlight>({ matched: new Set(), active: null });

/** Classes marking the setting `id` when the search found it. */
export function useHighlight(id: string): string {
  const { matched, active } = useContext(HighlightContext);
  if (active === id) return "ring-2 ring-primary";
  if (matched.has(id)) return "ring-1 ring-primary/60";
  return "";
}
