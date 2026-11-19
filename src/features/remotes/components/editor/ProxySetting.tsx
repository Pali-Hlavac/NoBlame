import { useId } from "react";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import {
  type Draft,
  effectiveValue,
  inheritedValues,
  setValues,
  valuesOf,
} from "../../lib/settings/draft";
import { remoteSetting } from "../../lib/settings/registry";
import { FIELD } from "../form";
import { SettingRow } from "./SettingRow";

interface ProxySettingProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

/** A placeholder address while a custom proxy is being typed in. */
const NEW_PROXY = "http://";

/**
 * `remote.<name>.proxy`: not set (git uses `http.proxy` or `HTTPS_PROXY`), none (an empty
 * value, which git reads as "no proxy for this remote"), or an address.
 */
export function ProxySetting({ base, draft, onChange }: ProxySettingProps) {
  const id = useId();
  const key = `remote.${base.name}.proxy`;
  const values = valuesOf(base, draft, key);
  const value = values.at(-1);
  const mode = value === undefined ? "unset" : value === "" ? "none" : "custom";
  const fallback = effectiveValue(base, { ...draft, keys: new Map() }, "http.proxy");
  return (
    <SettingRow
      setting={remoteSetting("proxy")}
      remote={base.name}
      controlId={id}
      inherited={value === undefined ? inheritedValues(base, key) : []}
    >
      <div className="flex gap-2">
        <select
          id={id}
          value={mode}
          className={FIELD}
          onChange={(event) => {
            const next = event.target.value;
            const wanted = next === "unset" ? [] : next === "none" ? [""] : [NEW_PROXY];
            onChange(setValues(base, draft, key, wanted));
          }}
        >
          <option value="unset">
            {fallback ? `As git decides (http.proxy: ${fallback})` : "As git decides (none set)"}
          </option>
          <option value="none">No proxy for this remote</option>
          <option value="custom">This proxy:</option>
        </select>
        {mode === "custom" ? (
          <input
            aria-label="Proxy address"
            value={value ?? ""}
            placeholder="http://proxy.example.com:8080"
            spellCheck={false}
            className={`${FIELD} flex-1 font-mono`}
            onChange={(event) => {
              onChange(setValues(base, draft, key, [event.target.value]));
            }}
          />
        ) : null}
      </div>
    </SettingRow>
  );
}
