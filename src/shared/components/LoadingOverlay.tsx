import { cn } from "@/shared/lib/cn";

import { BirdLoader } from "./BirdLoader";

/**
 * Covers content that is being replaced, so it stays in place instead of blinking away: blurs
 * it slightly and shows the bird. Fades in after a moment, so quick loads do not flash. The
 * parent must be positioned (`relative`).
 */
export function LoadingOverlay({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "absolute inset-0 z-10 flex animate-fade-in flex-col items-center justify-center gap-2 bg-background/40 text-sm text-muted-foreground backdrop-blur-[2px]",
        className,
      )}
    >
      <BirdLoader className="text-foreground" />
      <span>{label}</span>
    </div>
  );
}
