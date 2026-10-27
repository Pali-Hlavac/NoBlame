/** Recently opened repositories. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { commands, unwrap } from "@/shared/ipc/client";

export const recentKeys = { all: ["recent-repositories"] as const };

export function useRecentRepositories() {
  return useQuery({
    queryKey: recentKeys.all,
    queryFn: () => unwrap(commands.listRecentRepositories()),
  });
}

export function useRemoveRecentRepository() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => unwrap(commands.removeRecentRepository(path)),
    onSuccess: (remaining) => {
      queryClient.setQueryData(recentKeys.all, remaining);
    },
  });
}
