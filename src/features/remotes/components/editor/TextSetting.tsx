import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpenIcon } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { type Draft, inheritedValues, setValues, valuesOf } from "../../lib/settings/draft";
import { remoteSetting } from "../../lib/settings/registry";
import { FIELD } from "../form";
import { SettingRow } from "./SettingRow";

interface TextSettingProps {
  /** The registry id of the setting. */
  id: string;
  /** The key when the registry cannot name it (HTTP settings keyed by the server). */
  gitKey?: string;
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  placeholder?: string;
  /** Offers a file picker (certificates, keys). */
  browse?: string;
  /** Why the value cannot be saved, or undefined. */
  problem?: (value: string) => string | undefined;
  disabled?: boolean;
  unavailable?: string;
}

/** A setting with one value typed in; empty removes it from this repository. */
export function TextSetting(props: TextSettingProps) {
  const { base, draft, onChange } = props;
  const id = useId();
  const setting = remoteSetting(props.id);
  const key = props.gitKey ?? setting.key?.(base.name) ?? "";
  const value = valuesOf(base, draft, key).at(-1) ?? "";
  const set = (next: string) => {
    onChange(setValues(base, draft, key, next === "" ? [] : [next]));
  };
  const problem = value ? props.problem?.(value) : undefined;
  return (
    <SettingRow
      setting={setting}
      remote={base.name}
      controlId={id}
      shownKey={key}
      inherited={value ? [] : inheritedValues(base, key)}
      unavailable={props.unavailable}
    >
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          placeholder={props.placeholder}
          disabled={props.disabled}
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} flex-1 font-mono`}
          onChange={(event) => {
            set(event.target.value);
          }}
        />
        {props.browse ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              open({ multiple: false, directory: false, title: props.browse })
                .then((chosen) => {
                  if (typeof chosen === "string") set(chosen);
                })
                .catch((error: unknown) => {
                  toast.error("Could not show the file picker", { description: String(error) });
                });
            }}
          >
            <FolderOpenIcon aria-hidden />
            Browse…
          </Button>
        ) : null}
      </div>
      {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
    </SettingRow>
  );
}
