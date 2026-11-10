/** The submodule update waiting for confirmation (some submodules have new commits). */
import { create } from "zustand";

import type { SubmoduleDto } from "@/shared/ipc/bindings";

export interface SubmoduleUpdateRequest {
  /** The repository the submodules are in (where git runs). */
  parent: string;
  /** Their paths in it; empty: all of them. */
  paths: readonly string[];
  /** The submodules (and nested ones) checked out at another commit than the recorded one. */
  moved: readonly SubmoduleDto[];
}

interface SubmoduleUpdateState {
  request: SubmoduleUpdateRequest | null;
  setRequest: (request: SubmoduleUpdateRequest | null) => void;
}

export const useSubmoduleUpdateStore = create<SubmoduleUpdateState>()((set) => ({
  request: null,
  setRequest: (request) => {
    set({ request });
  },
}));
