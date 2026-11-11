import type { ReactNode } from "react";

import { APP_NAME, APP_TAGLINE, CLI_NAME } from "@/app.config";
import { useKeymap } from "@/shared/hooks/useKeys";
import { Kbd } from "@/shared/ui/kbd";

/** Shortcuts listed on the welcome screen (by id in `keybindings.ts`). */
const WELCOME_SHORTCUTS = [
  { label: "Command palette", id: "palette.open" },
  { label: "Close tab", id: "tabs.close" },
  { label: "Next tab", id: "tabs.next" },
  { label: "Previous tab", id: "tabs.previous" },
] as const;

interface WelcomeViewProps {
  /** Primary calls to action (e.g. "Open repository"), supplied by the app shell. */
  actions?: ReactNode;
  /** Something the user should know first (e.g. git is missing), shown above the actions. */
  notice?: ReactNode;
  /** Shown below the actions, e.g. recently opened repositories. */
  children?: ReactNode;
}

/** Landing tab shown on startup. */
export function WelcomeView({ actions, notice, children }: WelcomeViewProps) {
  const keysOf = useKeymap();
  const shortcuts = WELCOME_SHORTCUTS.map((shortcut) => ({
    label: shortcut.label,
    combo: keysOf(shortcut.id),
  })).filter((shortcut) => shortcut.combo !== "");
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-6 py-16 text-center">
      <img src="/songbird.png" alt="" className="h-28 w-auto" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Welcome to {APP_NAME}</h1>
        <p className="text-muted-foreground">{APP_TAGLINE}</p>
      </div>
      {notice}
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
      {children}
      <dl className="grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-left text-sm">
        {shortcuts.map((shortcut) => (
          <div key={shortcut.label} className="contents">
            <dt className="text-muted-foreground">{shortcut.label}</dt>
            <dd>
              <Kbd combo={shortcut.combo} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        From a terminal: <code className="font-mono">{CLI_NAME} &lt;path&gt;</code> opens a
        repository, <code className="font-mono">{CLI_NAME} --help</code> lists task windows.
      </p>
    </div>
  );
}
