import { useQueryClient } from "@tanstack/react-query";

import { shortId } from "@/features/graph";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

import { startSubmoduleUpdate } from "../api/submodules";
import { repositoryName } from "../lib/path";
import { useSubmoduleUpdateStore } from "../store/submoduleUpdate";

/**
 * Asks before an update moves submodules that have other commits checked out than the ones
 * their repository records. Mounted once, in the Repositories module.
 */
export function SubmoduleUpdateDialog() {
  const queryClient = useQueryClient();
  const request = useSubmoduleUpdateStore((state) => state.request);
  const setRequest = useSubmoduleUpdateStore((state) => state.setRequest);
  const moved = request?.moved ?? [];
  const one = moved.length === 1;
  return (
    <ConfirmDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) setRequest(null);
      }}
      title={one ? "Update this submodule?" : "Update these submodules?"}
      description={
        <>
          <span className="block">
            {one ? "It has" : "They have"} other commits checked out than{" "}
            {request ? repositoryName(request.parent) : "the repository"} records. Updating checks
            out the recorded {one ? "commit" : "commits"}:
          </span>
          <span className="my-2 block space-y-0.5">
            {moved.map((submodule) => (
              <span key={submodule.workDir} className="block font-mono text-xs">
                {submodule.path}: {shortId(submodule.checkedOut ?? "")} →{" "}
                {shortId(submodule.recorded ?? "")}
              </span>
            ))}
          </span>
          <span className="block">
            Commits made there are not lost: their branches, or their reflog, keep them. Git refuses
            when uncommitted changes are in the way.
          </span>
        </>
      }
      confirmLabel="Update"
      onConfirm={() => {
        if (request) startSubmoduleUpdate(queryClient, request.parent, request.paths);
        setRequest(null);
      }}
    />
  );
}
