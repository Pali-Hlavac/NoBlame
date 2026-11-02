import type { RepositoriesSection } from "@/shared/ipc/bindings";

import { useAppSettings, useChangeSettings } from "./useAppSettings";

/** The Repositories module's section order and folded sections, with functions that save them. */
export function useRepositorySections(): {
  order: readonly RepositoriesSection[];
  collapsed: readonly RepositoriesSection[];
  setOrder: (sections: RepositoriesSection[]) => void;
  setCollapsed: (sections: RepositoriesSection[]) => void;
} {
  const { repositories } = useAppSettings();
  const changeSettings = useChangeSettings();
  const save = (patch: {
    sections?: RepositoriesSection[];
    collapsedSections?: RepositoriesSection[];
  }): void => {
    changeSettings((current) => ({
      ...current,
      repositories: { ...current.repositories, ...patch },
    }));
  };
  return {
    order: repositories.sections,
    collapsed: repositories.collapsedSections,
    setOrder: (sections) => {
      save({ sections });
    },
    setCollapsed: (collapsedSections) => {
      save({ collapsedSections });
    },
  };
}
