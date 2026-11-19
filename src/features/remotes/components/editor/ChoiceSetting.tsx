import { useId } from "react";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import type { Choice } from "../../lib/settings/choices";
import { type Draft, inheritedValues, setValues, valuesOf } from "../../lib/settings/draft";
import { remoteSetting } from "../../lib/settings/registry";
import { FIELD } from "../form";
import { SettingRow } from "./SettingRow";

interface ChoiceSettingProps {
  /** The registry id of the setting. */
  id: string;
  /** The key when the registry cannot name it (HTTP settings keyed by the server). */
  gitKey?: string;
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  /** What "not set" means here (git's default or another setting). */
  unset: string;
  choices: readonly Choice[];
  disabled?: boolean;
  unavailable?: string;
  /** A warning shown for the value chosen, or none. */
  warn?: (value: string) => string | undefined;
}

/** A setting with a few values, chosen from a list; unknown values set by hand stay listed. */
export function ChoiceSetting(props: ChoiceSettingProps) {
  const { base, draft, onChange, choices } = props;
  const id = useId();
  const setting = remoteSetting(props.id);
  const key = props.gitKey ?? setting.key?.(base.name) ?? "";
  const value = valuesOf(base, draft, key).at(-1) ?? "";
  const known = value === "" || choices.some(([choice]) => choice === value);
  return (
    <SettingRow
      setting={setting}
      remote={base.name}
      controlId={id}
      shownKey={key}
      inherited={value ? [] : inheritedValues(base, key)}
      unavailable={props.unavailable}
      warning={props.warn?.(value)}
    >
      <select
        id={id}
        value={value}
        disabled={props.disabled}
        className={FIELD}
        onChange={(event) => {
          const next = event.target.value;
          onChange(setValues(base, draft, key, next ? [next] : []));
        }}
      >
        <option value="">{props.unset}</option>
        {choices.map(([choice, label]) => (
          <option key={choice} value={choice}>
            {label}
          </option>
        ))}
        {known ? null : <option value={value}>{value}</option>}
      </select>
    </SettingRow>
  );
}
