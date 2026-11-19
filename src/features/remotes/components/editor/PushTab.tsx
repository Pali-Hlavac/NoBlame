import { useId, useState } from "react";

import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import {
  PUSH_SIGN_CHOICES,
  RECURSE_SUBMODULE_CHOICES,
  YES_NO,
  yesNo,
} from "../../lib/settings/choices";
import {
  type Draft,
  effectiveValue,
  inheritedValues,
  setValues,
  valuesOf,
} from "../../lib/settings/draft";
import { remoteSetting } from "../../lib/settings/registry";
import { ChoiceSetting } from "./ChoiceSetting";
import { SettingRow } from "./SettingRow";

interface PushTabProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

const CHECKBOX = "size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring";
const PUSH_DEFAULT = "remote.pushDefault";

/** Where pushing goes and what it sends; the repository's push options below. */
export function PushTab({ base, draft, onChange }: PushTabProps) {
  const id = useId();
  const [confirmMirror, setConfirmMirror] = useState(false);
  const key = (name: string) => `remote.${base.name}.${name}`;
  const pushDefault = effectiveValue(base, draft, PUSH_DEFAULT);
  const refspecs = valuesOf(base, draft, key("push"));
  const mirror = yesNo(effectiveValue(base, draft, key("mirror"))) === "yes";
  const shared = { base, draft, onChange };

  return (
    <div className="grid gap-5">
      <SettingRow
        setting={remoteSetting("pushDefault")}
        remote={base.name}
        controlId={`${id}-default`}
        inherited={
          valuesOf(base, draft, PUSH_DEFAULT).length ? [] : inheritedValues(base, PUSH_DEFAULT)
        }
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            id={`${id}-default`}
            type="checkbox"
            className={CHECKBOX}
            checked={pushDefault === base.name}
            onChange={(event) => {
              onChange(
                setValues(base, draft, PUSH_DEFAULT, event.target.checked ? [base.name] : []),
              );
            }}
          />
          Push to {base.name} unless a branch says otherwise
          {pushDefault && pushDefault !== base.name ? ` (now: ${pushDefault})` : ""}
        </label>
      </SettingRow>
      <SettingRow
        setting={remoteSetting("pushRefspecs")}
        remote={base.name}
        controlId={`${id}-refs`}
        group
      >
        <div className="text-sm">
          {refspecs.length === 0 ? (
            <p className="text-muted-foreground">None set.</p>
          ) : (
            <ul className="font-mono text-xs">
              {refspecs.map((refspec) => (
                <li key={refspec}>{refspec}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Change them in the Advanced tab.</p>
        </div>
      </SettingRow>
      <SettingRow
        setting={remoteSetting("mirror")}
        remote={base.name}
        controlId={`${id}-mirror`}
        warning={
          mirror ? "Pushes to this remote replace and delete what differs there." : undefined
        }
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            id={`${id}-mirror`}
            type="checkbox"
            className={CHECKBOX}
            checked={mirror}
            onChange={(event) => {
              if (event.target.checked) setConfirmMirror(true);
              else onChange(setValues(base, draft, key("mirror"), []));
            }}
          />
          Every push to {base.name} is a mirror push
        </label>
      </SettingRow>
      <section aria-labelledby={`${id}-repo`} className="grid gap-5 border-t border-border pt-4">
        <div>
          <h3 id={`${id}-repo`} className="text-sm font-semibold">
            For every remote of this repository
          </h3>
          <p className="text-xs text-muted-foreground">
            These are the repository's own push settings: they apply whichever remote you push to.
          </p>
        </div>
        <ChoiceSetting
          id="followTags"
          {...shared}
          unset="Not set (git's default: no)"
          choices={YES_NO}
        />
        <ChoiceSetting
          id="autoSetupRemote"
          {...shared}
          unset="Not set (git's default: no)"
          choices={YES_NO}
        />
        <ChoiceSetting
          id="recurseSubmodules"
          {...shared}
          unset="Not set (git's default: ignore submodules)"
          choices={RECURSE_SUBMODULE_CHOICES}
        />
        <ChoiceSetting
          id="pushGpgSign"
          {...shared}
          unset="Not set (git's default: never)"
          choices={PUSH_SIGN_CHOICES}
        />
      </section>
      <ConfirmDialog
        open={confirmMirror}
        onOpenChange={setConfirmMirror}
        title={`Make every push to ${base.name} a mirror push?`}
        description={`Each push to ${base.name} would then make it exactly like this repository: branches and tags deleted here are deleted there, and branches that differ are overwritten, including commits other people pushed. Use it only for backups and mirrors nobody else pushes to. Nothing changes until you save.`}
        confirmLabel="Mirror on every push"
        destructive
        onConfirm={() => {
          setConfirmMirror(false);
          onChange(setValues(base, draft, key("mirror"), ["true"]));
        }}
      />
    </div>
  );
}
