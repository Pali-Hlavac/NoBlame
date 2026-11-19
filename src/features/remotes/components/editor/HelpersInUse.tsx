import type { HelpersInUse as InUse } from "../../lib/settings/credentials";
import { helperKind } from "../../lib/settings/credentials";
import { remoteSetting } from "../../lib/settings/registry";
import { SettingRow } from "./SettingRow";

interface HelpersInUseProps {
  remote: string;
  /** The helpers git asks for the remote's URL. */
  inUse: InUse;
}

/** The credential helpers git asks for this remote's URL, wherever they are set; read-only. */
export function HelpersInUse({ remote, inUse }: HelpersInUseProps) {
  const id = `credential-helpers-${remote}`;
  return (
    <SettingRow setting={remoteSetting("credentialHelpers")} remote={remote} controlId={id} group>
      {inUse.helpers.length === 0 ? (
        <p id={`${id}-none`} className="text-sm text-destructive">
          None: git asks for your password every time (NoBlame asks in the app) and keeps nothing.
          Install Git Credential Manager, or add a helper below.
        </p>
      ) : (
        <ol aria-labelledby={id} className="grid gap-1.5">
          {inUse.helpers.map((helper, index) => {
            const kind = helperKind(helper.value);
            return (
              // Helpers may repeat: the position is the identity.
              <li key={index} className="grid text-sm">
                <span>
                  <span className="font-medium">{kind.name}</span>{" "}
                  <code className="font-mono text-xs text-muted-foreground">{helper.value}</code>
                </span>
                <span className="text-xs text-muted-foreground">
                  {kind.about} Set in {helper.from}.
                </span>
                {kind.warning ? (
                  <span className="text-xs text-destructive">{kind.warning}</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {inUse.resetIn ? (
        <p className="text-xs text-muted-foreground">
          An empty value in {inUse.resetIn} drops the helpers set before it.
        </p>
      ) : null}
    </SettingRow>
  );
}
