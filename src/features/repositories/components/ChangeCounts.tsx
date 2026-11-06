import { useAppSettings } from "@/features/settings";
import type { ChangeCountsDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { useChangeCounts } from "../api/changeCounts";
import { describeChangeCounts } from "../lib/changeCounts";

const PARTS = [
  { key: "added", sign: "+", className: "text-status-added" },
  { key: "changed", sign: "~", className: "text-status-modified" },
  { key: "deleted", sign: "−", className: "text-status-deleted" },
] as const;

/** `+3 ~2 −1`, leaving out zeros; nothing for a clean working tree. */
export function ChangeCountsLabel({ counts }: { counts: ChangeCountsDto }) {
  const description = describeChangeCounts(counts);
  if (!description) return null;
  return (
    <span className="ml-auto flex shrink-0 gap-1 pl-1 font-mono text-xs" title={description}>
      {/* Read after the repository's name: "web, 2 new files not committed". */}
      <span className="sr-only">{`, ${description}`}</span>
      {PARTS.map(
        ({ key, sign, className }) =>
          counts[key] > 0 && (
            <span key={key} aria-hidden className={cn(className)}>
              {sign}
              {counts[key]}
            </span>
          ),
      )}
    </span>
  );
}

interface RepositoryChangeCountsProps {
  path: string;
  /** The path the repository's tab opened, when it is open. */
  sessionPath: string | undefined;
  /** `false` for a folder that no longer exists. */
  available?: boolean;
}

/** The uncommitted files of a repository row, when Settings → Repositories asks for them. */
export function RepositoryChangeCounts({
  path,
  sessionPath,
  available = true,
}: RepositoryChangeCountsProps) {
  const show = useAppSettings().repositories.showChangeCounts;
  const counts = useChangeCounts(path, sessionPath, show && available);
  return counts ? <ChangeCountsLabel counts={counts} /> : null;
}
