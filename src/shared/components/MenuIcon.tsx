import { toneClass, type ActionIcon } from "@/shared/lib/actionIcons";
import { cn } from "@/shared/lib/cn";

interface MenuIconProps {
  icon: ActionIcon | undefined;
  /** Keep the icon's room when there is none, so labels line up with their iconed siblings. */
  reserve: boolean;
}

/** A menu item's icon in its action's colour (see `shared/lib/actionIcons.ts`), or its room. */
export function MenuIcon({ icon, reserve }: MenuIconProps) {
  if (!icon) return reserve ? <span aria-hidden className="size-4 shrink-0" /> : null;
  const Icon = icon.icon;
  return <Icon aria-hidden className={cn("size-4 shrink-0", toneClass(icon.tone))} />;
}
