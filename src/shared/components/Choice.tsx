import type { ReactNode } from "react";

const INPUT_CLASS =
  "mt-0.5 size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

interface ChoiceProps {
  /** Unique within the page: the input's id, and the base of its detail's id. */
  id: string;
  type: "radio" | "checkbox";
  /** Radios of one group share it. */
  name?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  detail?: ReactNode;
}

/** A radio button or checkbox with its label and a line explaining it, for the dialogs. */
export function Choice({
  id,
  type,
  name,
  checked,
  disabled,
  onChange,
  label,
  detail,
}: ChoiceProps) {
  const detailId = `${id}-detail`;
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type={type}
        name={name}
        className={INPUT_CLASS}
        checked={checked}
        disabled={disabled}
        aria-describedby={detail ? detailId : undefined}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <div className="min-w-0">
        <label htmlFor={id} className={disabled ? "block text-muted-foreground" : "block"}>
          {label}
        </label>
        {detail ? (
          <p id={detailId} className="text-xs text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
