import { useState } from "react";

import { Button } from "@/shared/ui/button";

const FIELD =
  "h-7 min-w-0 rounded-md border border-border bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ConfigRowProps {
  /** The setting's name (`user.name`). */
  settingKey: string;
  /** Shown instead of the key, with the key below it. */
  label?: string;
  description?: string;
  /** Its value in this file; `undefined` when it is not set here. */
  value: string | undefined;
  placeholder?: string;
  pending: boolean;
  onSave: (value: string) => void;
  onRemove: () => void;
}

/** One setting: its name, its value to edit, Save (when changed) and Remove (when set). */
export function ConfigRow(props: ConfigRowProps) {
  const { settingKey, label, description, value, placeholder, pending } = props;
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    // Read again (saved here or changed elsewhere): show the file's value.
    setSeen(value);
    setDraft(value ?? "");
  }
  const changed = draft !== (value ?? "");
  return (
    <li data-setting-item className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <div className="w-full min-w-0">
        <span className="font-medium">{label ?? settingKey}</span>
        {label ? (
          <span className="ml-2 font-mono text-xs text-muted-foreground">{settingKey}</span>
        ) : null}
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
      <input
        aria-label={`Value of ${settingKey}`}
        className={`${FIELD} min-w-0 flex-1`}
        value={draft}
        placeholder={value === undefined ? (placeholder ?? "not set") : ""}
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
      <Button
        size="sm"
        className="h-7"
        disabled={!changed || pending}
        onClick={() => {
          props.onSave(draft);
        }}
      >
        Save
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7"
        disabled={value === undefined || pending}
        aria-label={`Remove ${settingKey}`}
        onClick={props.onRemove}
      >
        Remove
      </Button>
    </li>
  );
}
