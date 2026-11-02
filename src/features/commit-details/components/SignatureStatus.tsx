import type { LucideIcon } from "lucide-react";
import {
  LoaderIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldQuestionIcon,
  ShieldXIcon,
} from "lucide-react";

import type { SignatureFormatDto } from "@/shared/ipc/bindings";
import { useSettledValue } from "@/shared/hooks/useSettledValue";
import { cn } from "@/shared/lib/cn";

import { useSignatureCheck } from "../api/signature";
import type { SignatureTone } from "../lib/signature";
import { FORMAT_NAMES, describeCheck } from "../lib/signature";

/** Checks start once the selection has rested this long, so arrow-key browsing runs no gpg. */
export const SIGNATURE_CHECK_DELAY_MS = 300;

const TONES: Record<SignatureTone, { icon: LucideIcon; className: string }> = {
  good: { icon: ShieldCheckIcon, className: "text-success" },
  warning: { icon: ShieldAlertIcon, className: "text-warning" },
  bad: { icon: ShieldXIcon, className: "text-destructive" },
  muted: { icon: ShieldQuestionIcon, className: "text-muted-foreground" },
};

function Line({
  icon: Icon,
  className,
  text,
}: {
  icon: LucideIcon;
  className?: string;
  text: string;
}) {
  return (
    <span className={cn("flex items-start gap-1", className)}>
      {/* One line tall, so the icon stays beside the first line when the text wraps. */}
      <span className="flex h-5 shrink-0 items-center">
        <Icon aria-hidden className="size-3.5" />
      </span>
      <span className="min-w-0">{text}</span>
    </span>
  );
}

interface SignatureStatusProps {
  repoId: number;
  commitId: string;
  /** What the commit is signed with (from its details). */
  format: SignatureFormatDto;
}

/** Whether a signed commit's signature verifies, who signed it and with which key. */
export function SignatureStatus({ repoId, commitId, format }: SignatureStatusProps) {
  const settled = useSettledValue(commitId, SIGNATURE_CHECK_DELAY_MS);
  const check = useSignatureCheck(repoId, settled, true);
  const kind = `${FORMAT_NAMES[format]} signature`;
  if (settled !== commitId || check.isPending) {
    return (
      <Line icon={LoaderIcon} className="text-muted-foreground" text={`Checking the ${kind}…`} />
    );
  }
  if (check.error) {
    return (
      <Line
        icon={ShieldQuestionIcon}
        className="text-muted-foreground"
        text={`Could not check the ${kind}: ${check.error.message}`}
      />
    );
  }
  const result = check.data;
  if (!result) return <span className="text-muted-foreground">Not signed</span>;
  const { title, tone } = describeCheck(result);
  const key = result.fingerprint ?? result.key;
  return (
    <div className="min-w-0 flex-1 space-y-0.5">
      <Line icon={TONES[tone].icon} className={TONES[tone].className} text={title} />
      <span className="block text-muted-foreground">
        {FORMAT_NAMES[result.format]}
        {result.signer && <> · signed by {result.signer}</>}
        {result.trust && <> · trust: {result.trust}</>}
      </span>
      {key && (
        <code
          className="block truncate font-mono text-xs text-muted-foreground select-text"
          title={key}
        >
          {key}
        </code>
      )}
      {result.message && (
        <details className="text-xs" open={result.verdict === "cannotCheck"}>
          <summary className="cursor-pointer rounded text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Verification output
          </summary>
          {/* Wrapped, with gpg's alignment spaces collapsed, so a narrow pane shows the reason. */}
          <pre className="mt-1 font-mono break-words whitespace-pre-line select-text">
            {result.message}
          </pre>
        </details>
      )}
    </div>
  );
}
