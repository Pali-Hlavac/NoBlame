import { createContext } from "react";

/** Which repository tabs are open and which one is active, for marking rows in the tree. */
export interface OpenTabs {
  ids: ReadonlySet<string>;
  /** The path each open tab opened (its session's key), by tab id. */
  paths: ReadonlyMap<string, string>;
  activeId: string | null;
}

export const OpenTabsContext = createContext<OpenTabs>({
  ids: new Set(),
  paths: new Map(),
  activeId: null,
});
