import { toast } from "sonner";

import { WithActiveRepository } from "@/features/repositories";
import { useModuleHost } from "@/features/workbench";

import { CommitBeside } from "./CommitBeside";
import { CommitPanel } from "./CommitPanel";

/**
 * The Commit module: stage the active repository's changes and commit them. In the dock, a chosen
 * file opens in the diff tab; popped out, its diff shows beside the lists and the popup closes
 * after a commit.
 */
export function CommitModule() {
  const host = useModuleHost();
  const committed = (output: string): void => {
    host.close();
    toast.success("Committed", { description: output.split("\n")[0] });
  };
  return (
    <WithActiveRepository>
      {(summary, tab) =>
        host.placement === "popup" ? (
          <CommitBeside summary={summary} repoPath={tab.path} onCommitted={committed} />
        ) : (
          <CommitPanel repoId={summary.id} repoPath={tab.path} showDiff />
        )
      }
    </WithActiveRepository>
  );
}
