import { PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { FIELD } from "../form";

interface ValuesEditorProps {
  /** Names the list and its fields ("Push URL 2"). */
  label: string;
  /** The id of the first field, for a label pointing at it. */
  firstId?: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Text of the add button. */
  addLabel: string;
  /** Shown when there are no values. */
  empty?: string;
}

/** A setting that holds several values, each in its own field, in order. */
export function ValuesEditor({
  label,
  firstId,
  values,
  onChange,
  placeholder,
  addLabel,
  empty,
}: ValuesEditorProps) {
  const change = (index: number, value: string) => {
    onChange(values.map((old, at) => (at === index ? value : old)));
  };
  return (
    <div className="grid gap-1.5">
      {values.length === 0 && empty ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : null}
      {values.map((value, index) => (
        // Values may repeat and have no id: the position is the identity.
        <div key={index} className="flex gap-1">
          <input
            id={index === 0 ? firstId : undefined}
            aria-label={values.length > 1 ? `${label} ${String(index + 1)}` : label}
            value={value}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            className={`${FIELD} flex-1 font-mono`}
            onChange={(event) => {
              change(index, event.target.value);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${values.length > 1 ? `${label} ${String(index + 1)}` : label}`}
            title="Remove"
            onClick={() => {
              onChange(values.filter((_, at) => at !== index));
            }}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          onChange([...values, ""]);
        }}
      >
        <PlusIcon aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}
