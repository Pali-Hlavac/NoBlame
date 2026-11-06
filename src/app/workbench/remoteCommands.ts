/** The command palette's fetch, pull and push commands for the active repository. */
import type { PaletteCommand } from "@/features/command-palette";

import { FETCHES, PULLS, PUSH_ICON, useRemoteActions } from "./remote";

const GROUP = "Remote";
const KEYWORDS = ["remote", "sync"];

/** Fetch always; pull and push while a branch is checked out. */
export function useRemoteCommands(): PaletteCommand[] {
  const remote = useRemoteActions();
  if (!remote) return [];
  const fetches = FETCHES.map((fetch): PaletteCommand => ({
    id: `remote.${fetch.id}`,
    group: GROUP,
    label: fetch.label,
    icon: fetch.icon,
    kind: "branches",
    keywords: [...KEYWORDS, "download", "update", ...fetch.keywords],
    run: () => {
      remote.fetch(fetch.value);
    },
  }));
  if (remote.branch === undefined) return fetches;
  const pulls = PULLS.map((pull): PaletteCommand => ({
    id: `remote.${pull.id}`,
    group: GROUP,
    label: pull.label,
    icon: pull.icon,
    kind: "branches",
    keywords: [...KEYWORDS, "download", "update", ...pull.keywords],
    run: () => {
      remote.pull(pull.value);
    },
  }));
  const pushes: PaletteCommand[] = [
    {
      id: "remote.push",
      group: GROUP,
      label: "Push",
      icon: PUSH_ICON,
      kind: "branches",
      keywords: [...KEYWORDS, "upload", "publish"],
      run: remote.push,
    },
    {
      id: "remote.push-options",
      group: GROUP,
      label: "Push…",
      icon: PUSH_ICON,
      kind: "branches",
      keywords: [...KEYWORDS, "upload", "publish", "force", "tags", "upstream"],
      run: remote.pushWithOptions,
    },
  ];
  return [...pulls, ...pushes, ...fetches];
}
