import { AlertTriangleIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { useGitInfo } from "../api/gitInfo";
import { describeGitStatus } from "../lib/gitStatus";

/** Explains a missing or outdated git and how to fix it; renders nothing when git is fine. */
export function GitNotice({ className }: { className?: string }) {
  const query = useGitInfo();
  const status = describeGitStatus(query);
  if (status.tone === "ok" || status.tone === "pending") return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-md border p-3 text-left text-sm",
        status.tone === "error"
          ? "border-destructive/50 bg-destructive/10"
          : "border-warning/50 bg-warning/10",
        className,
      )}
    >
      <AlertTriangleIcon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          status.tone === "error" ? "text-destructive" : "text-warning",
        )}
      />
      <div className="grid flex-1 gap-1">
        <p className="font-medium">{status.detail}</p>
        {status.hint && <p className="text-muted-foreground">{status.hint}</p>}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        Check again
      </Button>
    </div>
  );
}
