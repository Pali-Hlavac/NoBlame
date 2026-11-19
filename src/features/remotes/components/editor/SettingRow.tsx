import type { ReactNode } from "react";

import type { ConfigValueDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import type { RemoteSetting } from "../../lib/settings/registry";
import { scopeName } from "../../lib/settings/words";
import { useHighlight } from "./highlight";

interface SettingRowProps {
  setting: RemoteSetting;
  /** The remote's name, for the git key shown. */
  remote: string;
  /** The id of the control the label names; for a group, the id of the label itself. */
  controlId: string;
  /** The control is a group (radio buttons) that names itself with `aria-labelledby={controlId}`. */
  group?: boolean;
  /** Values set elsewhere, shown when this repository sets none. */
  inherited?: readonly ConfigValueDto[];
  /** Why the setting cannot be changed (an older git), when it cannot. */
  unavailable?: string;
  /** A warning about the value chosen. */
  warning?: string;
  /** The git key shown, when the registry's is a pattern (`http.<server>/.sslVerify`). */
  shownKey?: string;
  children: ReactNode;
}

/** One setting: its label, the control, what it does and its git key; inherited values below. */
export function SettingRow({
  setting,
  remote,
  controlId,
  inherited = [],
  unavailable,
  warning,
  group = false,
  shownKey,
  children,
}: SettingRowProps) {
  const last = inherited.at(-1);
  const marked = useHighlight(setting.id);
  return (
    <div
      data-setting-id={setting.id}
      className={cn("-mx-2 grid gap-1 rounded-md px-2 py-1", marked)}
    >
      {group ? (
        <span id={controlId} className="text-sm font-medium">
          {setting.label}
        </span>
      ) : (
        <label htmlFor={controlId} className="text-sm font-medium">
          {setting.label}
        </label>
      )}
      {children}
      <p className="text-xs text-muted-foreground">
        {setting.help}
        {setting.repositoryWide ? " Applies to every remote of this repository." : ""}
        {setting.key ? (
          <>
            {" "}
            <code className="font-mono">{shownKey ?? setting.key(remote)}</code>
          </>
        ) : null}
      </p>
      {warning ? <p className="text-xs text-destructive">{warning}</p> : null}
      {unavailable ? <p className="text-xs text-muted-foreground">{unavailable}</p> : null}
      {last ? (
        <p className="text-xs text-muted-foreground">
          Not set in this repository; {scopeName(last.scope)}
          {last.file ? ` (${last.file})` : ""} say{" "}
          <code className="font-mono text-foreground">{last.value}</code>.
        </p>
      ) : null}
    </div>
  );
}
