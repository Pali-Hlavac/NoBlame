import { AlertTriangleIcon, CheckCircle2Icon, LoaderCircleIcon, XCircleIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Tooltip } from "@/shared/ui/tooltip";

import { useGitInfo } from "../api/gitInfo";
import { describeGitStatus, type GitStatusTone } from "../lib/gitStatus";

const TONE_ICONS = {
  pending: LoaderCircleIcon,
  ok: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  error: XCircleIcon,
} as const;

const TONE_CLASSES: Record<GitStatusTone, string> = {
  pending: "animate-spin",
  ok: "text-primary",
  warning: "text-warning",
  error: "text-destructive",
};

/** Status-bar entry showing the git in use; clicking checks again. */
export function GitStatusButton() {
  const query = useGitInfo();
  const status = describeGitStatus(query);
  const Icon = TONE_ICONS[status.tone];
  const tooltip = [status.detail, status.hint, "Click to check again."].filter(Boolean).join(" ");

  return (
    <Tooltip content={<span className="block max-w-xs">{tooltip}</span>}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1.5 px-2 text-xs"
        aria-label={`${status.label}. ${tooltip}`}
        onClick={() => void query.refetch()}
      >
        <Icon aria-hidden className={cn("size-3.5", TONE_CLASSES[status.tone])} />
        {status.label}
      </Button>
    </Tooltip>
  );
}
