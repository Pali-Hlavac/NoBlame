import { createContext } from "react";

/** Which repository tabs are open and which one is active, for marking rows in the tree. */
export interface OpenTabs {
  ids: ReadonlySet<string>;
  activeId: string | null;
}

export const OpenTabsContext = createContext<OpenTabs>({ ids: new Set(), activeId: null });
