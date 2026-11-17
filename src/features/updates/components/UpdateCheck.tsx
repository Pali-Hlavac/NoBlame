import { useMutation } from "@tanstack/react-query";

import { InlineError } from "@/shared/components/InlineError";
import { Button } from "@/shared/ui/button";

import { checkForUpdate, useUpdateSupport } from "../api/updates";
import { showUpdate } from "../store/updates";

/** About's line on updates: Check for updates, or why this build does not update. */
export function UpdateCheck() {
  const support = useUpdateSupport();
  const check = useMutation({
    meta: { silent: true },
    mutationFn: checkForUpdate,
    onSuccess: (update) => {
      if (update) showUpdate(update);
    },
  });
  if (!support.data) return null;
  if (!support.data.configured) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        This build does not update itself: it was built from source, not installed from a release.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 text-sm">
      <Button
        variant="outline"
        size="sm"
        disabled={check.isPending}
        onClick={() => {
          check.mutate();
        }}
      >
        {check.isPending ? "Checking…" : "Check for updates"}
      </Button>
      {check.isSuccess && check.data === null && (
        <p role="status" className="text-xs text-muted-foreground">
          You have the newest version.
        </p>
      )}
      {check.error && <InlineError error={check.error} />}
    </div>
  );
}
