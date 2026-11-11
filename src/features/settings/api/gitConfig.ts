/** Git's settings of a scope (the repository's, or the user's), read and written on request. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ConfigScopeDto } from "@/shared/ipc/bindings";
import { commands, unwrap } from "@/shared/ipc/client";

export const gitConfigKeys = {
  all: ["git-config"] as const,
  scope: (repoId: number, scope: ConfigScopeDto) => ["git-config", repoId, scope] as const,
};

/** The settings of `scope` as repository `repoId` sees them. */
export function useGitConfig(repoId: number, scope: ConfigScopeDto) {
  return useQuery({
    queryKey: gitConfigKeys.scope(repoId, scope),
    queryFn: () => unwrap(commands.getGitConfig(repoId, scope)),
  });
}

/** Sets (`value` a string) or removes (`value` null) a setting; every scope is read again. */
export function useWriteGitConfig(repoId: number, scope: ConfigScopeDto) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | null }) =>
      unwrap(
        value === null
          ? commands.unsetGitConfig(repoId, scope, key)
          : commands.setGitConfig(repoId, scope, key, value),
      ),
    meta: { silent: true, activity: "Saving the Git setting" },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gitConfigKeys.all }),
  });
}
