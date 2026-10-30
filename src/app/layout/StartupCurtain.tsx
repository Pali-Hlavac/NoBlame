import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { BirdLoader } from "@/shared/components/BirdLoader";
import { cn } from "@/shared/lib/cn";

/** Nothing loading for this long counts as started. */
const SETTLED_MS = 200;
/**
 * The curtain lifts after this long even if something still loads: a huge repository's
 * history has its own loading state.
 */
const MAX_COVER_MS = 5_000;
/** Length of the fade, as `duration-500` below. */
const LIFT_MS = 500;

type Phase = "covering" | "lifting" | "gone";

/** The next phase when it is time to lift (once only). */
const lifted = (phase: Phase): Phase => (phase === "covering" ? "lifting" : phase);

/**
 * Covers the window while it starts. It is opaque until the first screen is `rendered`, then
 * shows the window blurred behind the singing bird until nothing loads any more (no query or
 * mutation for a moment); then the blur clears and the curtain fades out.
 */
export function StartupCurtain({ rendered }: { rendered: boolean }) {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [phase, setPhase] = useState<Phase>("covering");

  // Lifts once nothing has loaded for a moment.
  useEffect(() => {
    if (!rendered || busy) return;
    const timer = setTimeout(() => {
      setPhase(lifted);
    }, SETTLED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [rendered, busy]);

  // And at the latest this long after the first render.
  useEffect(() => {
    if (!rendered) return;
    const timer = setTimeout(() => {
      setPhase(lifted);
    }, MAX_COVER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [rendered]);

  useEffect(() => {
    if (phase !== "lifting") return;
    const timer = setTimeout(() => {
      setPhase("gone");
    }, LIFT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  if (phase === "gone") return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-100 flex flex-col items-center justify-center gap-3 backdrop-blur-xl transition-[opacity,backdrop-filter] duration-500 ease-out motion-reduce:transition-none",
        rendered ? "bg-background/50" : "bg-background",
        phase === "lifting" && "pointer-events-none opacity-0 backdrop-blur-[0px]",
      )}
    >
      <BirdLoader className="h-16 w-24 text-foreground" />
      <span className="text-sm text-muted-foreground">Starting…</span>
    </div>
  );
}
