/** Building blocks of the Settings tab. */
import { useId, type ReactNode } from "react";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-border pb-1 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A checkbox with a label and a sentence saying what it changes. */
export function Toggle({ label, description, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        aria-describedby={`${id}-description`}
        className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

interface ChoiceProps<T extends string> {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Lays the options out in a row instead of one per line. */
  inline?: boolean;
}

/** Radio buttons for one setting. */
export function Choice<T extends string>({
  legend,
  options,
  value,
  onChange,
  inline,
}: ChoiceProps<T>) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className={inline ? "flex gap-4" : "space-y-1.5"}>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={name}
              value={option.value}
              className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
