import { AlertTriangleIcon, CheckIcon } from "lucide-react";

import { cn } from "@/shared/lib/cn";

interface CommitOutputProps {
  tone: "success" | "error";
  /** What git and its hooks printed, kept as written (lines, alignment). */
  text: string;
}

/** Git's output after a commit: its summary line, or why it refused (a hook's messages). */
export function CommitOutput({ tone, text }: CommitOutputProps) {
  const Icon = tone === "error" ? AlertTriangleIcon : CheckIcon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex max-h-40 gap-2 overflow-auto rounded-md border p-2",
        tone === "error"
          ? "border-destructive/50 bg-destructive/10"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "error" ? "text-destructive" : "text-kind-commit",
        )}
        aria-hidden
      />
      <pre className="min-w-0 font-mono text-xs whitespace-pre-wrap select-text">{text}</pre>
    </div>
  );
}
