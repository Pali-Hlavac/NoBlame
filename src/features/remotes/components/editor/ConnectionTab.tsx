import { useId } from "react";

import { useGitInfo } from "@/features/git-env";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { isWindowsPlatform } from "@/shared/lib/platform";

import {
  HTTP_VERSION_CHOICES,
  PROXY_AUTH_CHOICES,
  SSL_BACKEND_CHOICES,
  YES_NO,
} from "../../lib/settings/choices";
import { type Draft, setValues, valuesOf } from "../../lib/settings/draft";
import { gitRelease, remoteSetting, supports } from "../../lib/settings/registry";
import { httpKey } from "../../lib/settings/registryConnection";
import { serverOf } from "../../lib/settings/urlKeyed";
import { ChoiceSetting } from "./ChoiceSetting";
import { ProxySetting } from "./ProxySetting";
import { SettingRow } from "./SettingRow";
import { SshKeySetting } from "./SshKeySetting";
import { TextSetting } from "./TextSetting";
import { ValuesEditor } from "./ValuesEditor";

interface ConnectionTabProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

const BYTES = /^\d+[kmg]?$/i;

/** How git reaches the remote: HTTP(S) settings for its server, the SSH key, the rest. */
export function ConnectionTab({ base, draft, onChange }: ConnectionTabProps) {
  const id = useId();
  const shared = { base, draft, onChange };
  const url = valuesOf(base, draft, `remote.${base.name}.url`)[0];
  const server = serverOf(url);
  const http = server?.startsWith("http") ?? false;
  const key = (name: string) => (server ? httpKey(base, server, name) : "");
  const release = gitRelease(useGitInfo().data?.version);
  const serverOption = remoteSetting("serverOption");
  const headers = key("extraHeader");
  const number = (value: string) =>
    BYTES.test(value) ? undefined : "A number, such as 1048576 or 500m.";

  return (
    <div className="grid gap-5">
      <section aria-labelledby={`${id}-http`} className="grid gap-5">
        <div>
          <h3 id={`${id}-http`} className="text-sm font-semibold">
            HTTP(S){server ? `, for ${server}` : ""}
          </h3>
          <p className="text-xs text-muted-foreground">
            {http
              ? "Saved in this repository for every address on this server."
              : "This remote's URL is not an http(s) address: these settings do not apply to it."}
          </p>
        </div>
        {http ? (
          <>
            <ProxySetting {...shared} />
            <ChoiceSetting
              id="proxyAuthMethod"
              {...shared}
              unset="Not set (whatever the proxy asks for)"
              choices={PROXY_AUTH_CHOICES}
            />
            <ChoiceSetting
              id="sslVerify"
              gitKey={key("sslVerify")}
              {...shared}
              unset="Not set (yes)"
              choices={YES_NO}
              warn={(value) =>
                value === "false"
                  ? "Anyone between you and the server could read and change what you fetch and push. Prefer giving git the server's certificate (below)."
                  : undefined
              }
            />
            <TextSetting
              id="sslCAInfo"
              gitKey={key("sslCAInfo")}
              {...shared}
              placeholder="C:/certificates/company-root.pem"
              browse="Choose the certificate file"
            />
            {isWindowsPlatform() ? (
              <ChoiceSetting
                id="sslBackend"
                {...shared}
                unset="Not set (as Git for Windows was installed)"
                choices={SSL_BACKEND_CHOICES}
              />
            ) : null}
            <TextSetting
              id="sslCert"
              gitKey={key("sslCert")}
              {...shared}
              browse="Choose the client certificate"
            />
            <TextSetting
              id="sslKey"
              gitKey={key("sslKey")}
              {...shared}
              browse="Choose the certificate's key"
            />
            <SettingRow
              setting={remoteSetting("extraHeader")}
              remote={base.name}
              controlId={`${id}-h`}
              shownKey={headers}
            >
              <ValuesEditor
                label="Header"
                firstId={`${id}-h`}
                values={valuesOf(base, draft, headers)}
                placeholder="Authorization: Bearer …"
                addLabel="Add a header"
                empty="None."
                onChange={(values) => {
                  onChange(setValues(base, draft, headers, values));
                }}
              />
            </SettingRow>
            <ChoiceSetting
              id="httpVersion"
              gitKey={key("version")}
              {...shared}
              unset="Not set (the newest both sides know)"
              choices={HTTP_VERSION_CHOICES}
            />
            <TextSetting
              id="postBuffer"
              gitKey={key("postBuffer")}
              {...shared}
              placeholder="1m"
              problem={number}
            />
            <TextSetting
              id="lowSpeedLimit"
              gitKey={key("lowSpeedLimit")}
              {...shared}
              placeholder="bytes per second"
              problem={number}
            />
            <TextSetting
              id="lowSpeedTime"
              gitKey={key("lowSpeedTime")}
              {...shared}
              placeholder="seconds"
              problem={number}
            />
          </>
        ) : null}
      </section>
      <section aria-labelledby={`${id}-ssh`} className="grid gap-5 border-t border-border pt-4">
        <h3 id={`${id}-ssh`} className="text-sm font-semibold">
          SSH
        </h3>
        <SshKeySetting {...shared} />
      </section>
      <section aria-labelledby={`${id}-more`} className="grid gap-5 border-t border-border pt-4">
        <h3 id={`${id}-more`} className="text-sm font-semibold">
          Rarely needed
        </h3>
        <TextSetting id="uploadpack" {...shared} placeholder="git-upload-pack" />
        <TextSetting id="receivepack" {...shared} placeholder="git-receive-pack" />
        <SettingRow
          setting={serverOption}
          remote={base.name}
          controlId={`${id}-so`}
          unavailable={
            supports(release, serverOption.since)
              ? undefined
              : `Needs git ${(serverOption.since ?? []).join(".")} or later.`
          }
        >
          <ValuesEditor
            label="Server option"
            firstId={`${id}-so`}
            values={valuesOf(base, draft, `remote.${base.name}.serverOption`)}
            addLabel="Add an option"
            empty="None."
            onChange={(values) => {
              onChange(setValues(base, draft, `remote.${base.name}.serverOption`, values));
            }}
          />
        </SettingRow>
      </section>
    </div>
  );
}
