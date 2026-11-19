import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { YES_NO } from "../../lib/settings/choices";
import { savedLfsServer } from "../../lib/settings/conditions";
import { type Draft, effectiveValue, valuesOf } from "../../lib/settings/draft";
import { lfsEndpoint } from "../../lib/settings/hosts";
import { ChoiceSetting } from "./ChoiceSetting";
import { TextSetting } from "./TextSetting";

interface LfsTabProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

/** Where this remote keeps LFS contents, and whether pushing checks locks there. */
export function LfsTab({ base, draft, onChange }: LfsTabProps) {
  const shared = { base, draft, onChange };
  const url = valuesOf(base, draft, `remote.${base.name}.url`)[0] ?? "";
  const derived = lfsEndpoint(url);
  // The lock check is keyed by the saved LFS server, so typing a new one does not move it.
  const server = savedLfsServer(base);
  const serverChanged =
    (effectiveValue(base, draft, `remote.${base.name}.lfsurl`) ?? derived) !== server;
  return (
    <div className="grid gap-5">
      <p className="text-xs text-muted-foreground">
        The LFS module lists the LFS files and the locks on the server.
      </p>
      <TextSetting id="lfsurl" {...shared} placeholder={derived ?? "https://…/info/lfs"} />
      <TextSetting id="lfspushurl" {...shared} placeholder="The LFS server above" />
      {server ? (
        <ChoiceSetting
          id="locksverify"
          gitKey={`lfs.${server}.locksverify`}
          {...shared}
          unset="Not set (checked when the server keeps locks)"
          choices={YES_NO}
          unavailable={
            serverChanged
              ? `This is for ${server}; save the new LFS server first to set it there.`
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
