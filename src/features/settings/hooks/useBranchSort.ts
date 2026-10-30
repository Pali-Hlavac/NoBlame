import type { BranchSort } from "@/shared/ipc/bindings";

import { useAppSettings, useChangeSettings } from "./useAppSettings";

/** How the Branches module orders each section, and a function that saves another order. */
export function useBranchSort(): [BranchSort, (sort: BranchSort) => void] {
  const { branches } = useAppSettings();
  const changeSettings = useChangeSettings();
  return [
    branches.sort,
    (sort) => {
      changeSettings((current) => ({ ...current, branches: { ...current.branches, sort } }));
    },
  ];
}
