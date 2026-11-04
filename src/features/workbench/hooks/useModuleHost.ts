import { createContext, useContext } from "react";

/** Where a module is showing: in the module dock, or popped out in a popup. */
export interface ModuleHost {
  placement: "dock" | "popup";
  /** Closes the popup (the module keeps its state); does nothing in the dock. */
  close: () => void;
}

const DOCK_HOST: ModuleHost = { placement: "dock", close: () => undefined };

export const ModuleHostContext = createContext<ModuleHost>(DOCK_HOST);

/**
 * Where the calling module is showing. Modules mostly do not care; one may lay itself out
 * differently in a popup (the Commit module shows the diff beside its lists there).
 */
export function useModuleHost(): ModuleHost {
  return useContext(ModuleHostContext);
}
