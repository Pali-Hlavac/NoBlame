import type { ReactNode } from "react";

import type { ConfigValueDto } from "@/shared/ipc/bindings";

import type { RemoteSetting } from "../../lib/settings/registry";
import { scopeName } from "../../lib/settings/words";

interface SettingRowProps {
  setting: RemoteSetting;
  /** The remote's name, for the git key shown. */
  remote: string;
  /** The id of the control the label names. */
  controlId: string;
  /** Values set elsewhere, shown when this repository sets none. */
  inherited?: readonly ConfigValueDto[];
  /** Why the setting cannot be changed (an older git), when it cannot. */
  unavailable?: string;
  children: ReactNode;
}

/** One setting: its label, the control, what it does and its git key; inherited values below. */
export function SettingRow({
  setting,
  remote,
  controlId,
  inherited = [],
  unavailable,
  children,
}: SettingRowProps) {
  const last = inherited.at(-1);
  return (
    <div data-setting-id={setting.id} className="grid gap-1 rounded-md">
      <label htmlFor={controlId} className="text-sm font-medium">
        {setting.label}
      </label>
      {children}
      <p className="text-xs text-muted-foreground">
        {setting.help}
        {setting.key ? (
          <>
            {" "}
            <code className="font-mono">{setting.key(remote)}</code>
          </>
        ) : null}
      </p>
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
