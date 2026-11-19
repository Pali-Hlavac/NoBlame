import { useId } from "react";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import {
  AZURE_CREDENTIAL_CHOICES,
  MSAUTH_FLOW_CHOICES,
  PROVIDER_CHOICES,
  YES_NO,
} from "../../lib/settings/choices";
import { onWindows, withManager } from "../../lib/settings/conditions";
import { helpersFor } from "../../lib/settings/credentials";
import { type Draft, setValues, valuesOf } from "../../lib/settings/draft";
import { azureOrganization } from "../../lib/settings/hosts";
import { remoteSetting } from "../../lib/settings/registry";
import { serverOf } from "../../lib/settings/urlKeyed";
import { ChoiceSetting } from "./ChoiceSetting";
import { CredentialActions } from "./CredentialActions";
import { HelpersInUse } from "./HelpersInUse";
import { SettingRow } from "./SettingRow";
import { TextSetting } from "./TextSetting";
import { ValuesEditor } from "./ValuesEditor";

interface CredentialsTabProps {
  repoId: number;
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  dirty: boolean;
}

/** How git signs in to the remote's server: the helpers asked, their settings, Azure DevOps. */
export function CredentialsTab({ repoId, base, draft, onChange, dirty }: CredentialsTabProps) {
  const id = useId();
  const shared = { base, draft, onChange };
  const url = valuesOf(base, draft, `remote.${base.name}.url`)[0] ?? "";
  const server = serverOf(url);
  if (!server?.startsWith("http")) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        {base.name}'s URL is not an http(s) address, so git does not ask a credential helper for it.
        Over SSH it signs in with your SSH key (see the Connection tab).
      </p>
    );
  }
  const key = (name: string) => `credential.${server}.${name}`;
  const inUse = helpersFor(base, draft, url);
  const manager = withManager(base, draft);
  const organization = azureOrganization(url);
  const helperKey = key("helper");

  return (
    <div className="grid gap-5">
      <section aria-labelledby={`${id}-in`} className="grid gap-5">
        <div>
          <h3 id={`${id}-in`} className="text-sm font-semibold">
            Signing in to {server}
          </h3>
          <p className="text-xs text-muted-foreground">
            Saved in this repository for every address on this server.
          </p>
        </div>
        <HelpersInUse remote={base.name} inUse={inUse} />
        <CredentialActions repoId={repoId} remote={base.name} server={server} dirty={dirty} />
        <SettingRow
          setting={remoteSetting("credentialHelper")}
          remote={base.name}
          controlId={`${id}-helper`}
          shownKey={helperKey}
        >
          <ValuesEditor
            label="Helper"
            firstId={`${id}-helper`}
            values={valuesOf(base, draft, helperKey)}
            placeholder="manager"
            addLabel="Add a helper"
            empty="None."
            onChange={(values) => {
              onChange(setValues(base, draft, helperKey, values));
            }}
          />
        </SettingRow>
        <TextSetting id="credentialUsername" gitKey={key("username")} {...shared} />
        <ChoiceSetting
          id="useHttpPath"
          gitKey={key("useHttpPath")}
          {...shared}
          unset="Not set (one sign-in for the whole server)"
          choices={YES_NO}
        />
        {manager ? (
          <ChoiceSetting
            id="credentialProvider"
            gitKey={key("provider")}
            {...shared}
            unset="Not set (told from the address)"
            choices={PROVIDER_CHOICES}
          />
        ) : null}
      </section>
      {organization ? (
        <section aria-labelledby={`${id}-azure`} className="grid gap-5 border-t border-border pt-4">
          <div>
            <h3 id={`${id}-azure`} className="text-sm font-semibold">
              Azure DevOps, organization {organization}
            </h3>
            <p className={manager ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
              {manager
                ? "Git Credential Manager signs in to Azure DevOps; these settings tell it how."
                : "Git Credential Manager signs in to Azure DevOps, and it is not among the helpers above: these settings do nothing without it."}
            </p>
          </div>
          <TextSetting
            id="azureAccount"
            gitKey={`credential.azrepos:org/${organization}.username`}
            {...shared}
            placeholder="ada@contoso.com"
          />
          <ChoiceSetting
            id="azureCredentialType"
            gitKey={key("azreposCredentialType")}
            {...shared}
            unset="Not set (a Microsoft account)"
            choices={AZURE_CREDENTIAL_CHOICES}
          />
          {onWindows(base, draft) ? (
            <ChoiceSetting
              id="msauthUseBroker"
              gitKey={key("msauthUseBroker")}
              {...shared}
              unset="Not set (as Git Credential Manager decides)"
              choices={YES_NO}
            />
          ) : null}
          <ChoiceSetting
            id="msauthFlow"
            gitKey={key("msauthFlow")}
            {...shared}
            unset="Not set (whatever works best here)"
            choices={MSAUTH_FLOW_CHOICES}
          />
        </section>
      ) : null}
    </div>
  );
}
