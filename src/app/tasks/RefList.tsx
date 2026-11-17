import { CornerDownLeftIcon, GitBranchIcon, GlobeIcon, TagIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { pickerSections } from "@/features/graph";
import type { RefEntry, RefKindDto } from "@/shared/ipc/bindings";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";

import type { PickedRef } from "./pickRef";

const ICONS: Partial<Record<RefKindDto, typeof GitBranchIcon>> = {
  branch: GitBranchIcon,
  remote: GlobeIcon,
  tag: TagIcon,
};

interface RefListProps {
  /** The list's accessible name (the dialog's title). */
  label: string;
  refs: readonly RefEntry[];
  /** The list value of the current branch's upstream, marked in the list. */
  upstream: string | undefined;
  /** The value chosen at first (the upstream, for merging and rebasing). */
  initial: string | undefined;
  /** Nothing can be chosen (an operation is in progress). */
  disabled: boolean;
  onChoose: (picked: PickedRef) => void;
}

/** Branches, remote branches and tags filtered by what is typed, or the revision typed. */
export function RefList({ label, refs, upstream, initial, disabled, onChoose }: RefListProps) {
  const [query, setQuery] = useState("");
  const [value, setValue] = useState(initial);
  const { sections, hidden } = useMemo(() => pickerSections(refs, query), [refs, query]);
  const typed = query.trim();
  // The list shows once the branches are read, after the dialog placed its focus.
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <Command
      shouldFilter={false}
      label={label}
      value={value}
      onValueChange={setValue}
      className="border border-border"
    >
      <CommandInput
        ref={input}
        placeholder="Branch, tag, commit id or HEAD~2…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        {sections.map((section) => (
          <CommandGroup key={section.kind} heading={section.title}>
            {section.refs.map((entry) => {
              const Icon = ICONS[entry.label.kind] ?? GitBranchIcon;
              const itemValue = `${entry.label.kind}:${entry.label.name}`;
              return (
                <CommandItem
                  key={itemValue}
                  value={itemValue}
                  disabled={disabled}
                  onSelect={() => {
                    onChoose({ kind: "ref", entry });
                  }}
                >
                  <Icon aria-hidden className="text-kind-branches" />
                  <span className="truncate">{entry.label.name}</span>
                  {itemValue === upstream ? (
                    <span className="ml-auto text-xs text-muted-foreground">upstream</span>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        {typed !== "" && (
          <CommandGroup heading="Revision">
            <CommandItem
              value={`typed:${typed}`}
              disabled={disabled}
              onSelect={() => {
                onChoose({ kind: "typed", revision: typed });
              }}
            >
              <CornerDownLeftIcon aria-hidden />
              <span className="truncate">Use “{typed}”</span>
            </CommandItem>
          </CommandGroup>
        )}
        {hidden > 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {hidden.toLocaleString()} more; type to narrow the list.
          </p>
        )}
      </CommandList>
    </Command>
  );
}
