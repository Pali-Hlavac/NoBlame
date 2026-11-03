import type { CSSProperties } from "react";

import { cn } from "@/shared/lib/cn";
import { initials, personHue } from "@/shared/lib/person";

interface PersonBadgeProps {
  name: string;
  email: string;
  className?: string;
}

/**
 * A round badge with a person's initials, coloured by their e-mail address (only the hue
 * changes; the theme sets the rest). Decorative: the name is always written beside it.
 */
export function PersonBadge({ name, email, className }: PersonBadgeProps) {
  // The theme turns the hue into a colour (`bg-person` in styles.css).
  const style = { "--person-hue": personHue(email, name) } as CSSProperties;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-person text-[0.625rem] leading-none font-semibold select-none",
        className,
      )}
      style={style}
    >
      {initials(name)}
    </span>
  );
}
