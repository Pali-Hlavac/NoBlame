import { useRef, useState } from "react";

interface GroupNameFieldProps {
  name: string;
  /** Called with the new name on Enter or when the field loses focus. */
  onCommit: (name: string) => void;
  /** Called on Escape, and after committing. */
  onDone: () => void;
}

/** A group's name as a text field, focused and selected, while it is renamed. */
export function GroupNameField({ name, onCommit, onDone }: GroupNameFieldProps) {
  const [value, setValue] = useState(name);
  // Enter or Escape ends editing; a blur from the field going away must not commit again.
  const finished = useRef(false);
  const finish = (save: boolean): void => {
    if (finished.current) return;
    finished.current = true;
    const trimmed = value.trim();
    if (save && trimmed && trimmed !== name) onCommit(trimmed);
    onDone();
  };
  return (
    <input
      aria-label="Group name"
      // The field replaces the name the user just chose to edit.
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      value={value}
      className="min-w-0 flex-1 rounded-sm border border-border bg-background px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onFocus={(event) => {
        event.currentTarget.select();
      }}
      onChange={(event) => {
        setValue(event.target.value);
      }}
      onBlur={() => {
        finish(true);
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(true);
        if (event.key === "Escape") finish(false);
      }}
    />
  );
}
