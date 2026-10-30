import { cn } from "@/shared/lib/cn";

import { BirdLoader } from "./BirdLoader";

/** The singing bird with a label announced to screen readers. */
export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground",
        className,
      )}
    >
      <BirdLoader className="h-6 w-9 text-foreground" />
      <span>{label}</span>
    </div>
  );
}
