import { CheckIcon, ChevronDownIcon, GitBranchIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type { TipsDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import { useRefs } from "../api/refs";
import { headNameOf, isChosen, pickerSections, tipsLabel } from "../lib/filter";
import { FILTER_CONTROL_CLASSES } from "./filterStyles";

interface BranchPickerProps {
  repoId: number;
  tips: TipsDto;
  onChange: (tips: TipsDto) => void;
}

function PickerItem(props: {
  value: string;
  chosen: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <CommandItem value={props.value} onSelect={props.onSelect}>
      <CheckIcon className={cn(!props.chosen && "invisible")} aria-hidden />
      <span className="truncate">{props.children}</span>
    </CommandItem>
  );
}

/** Chooses whose history the tab shows: all references, HEAD, or one branch or tag. */
export function BranchPicker({ repoId, tips, onChange }: BranchPickerProps) {
  const refs = useRefs(repoId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const headName = headNameOf(refs.data);
  const { sections, hidden } = useMemo(
    () => pickerSections(refs.data ?? [], query),
    [refs.data, query],
  );
  const label = tipsLabel(tips, headName);
  const choose = (next: TipsDto) => {
    setOpen(false);
    setQuery("");
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Show the history of: ${label}`}
          title={label}
          className={cn(FILTER_CONTROL_CLASSES, "max-w-56 min-w-0")}
        >
          <GitBranchIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command shouldFilter={false} label="Show the history of">
          <CommandInput
            placeholder="Find a branch or tag…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {refs.isPending ? "Reading branches…" : "No branch or tag matches."}
            </CommandEmpty>
            {query.trim() === "" && (
              <CommandGroup>
                <PickerItem
                  value="all"
                  chosen={tips.type === "all"}
                  onSelect={() => {
                    choose({ type: "all" });
                  }}
                >
                  All branches
                </PickerItem>
                <PickerItem
                  value="head"
                  chosen={tips.type === "head"}
                  onSelect={() => {
                    choose({ type: "head" });
                  }}
                >
                  {tipsLabel({ type: "head" }, headName)}
                </PickerItem>
              </CommandGroup>
            )}
            {sections.map((section) => (
              <CommandGroup key={section.kind} heading={section.title}>
                {section.refs.map(({ label: ref }) => (
                  <PickerItem
                    key={ref.name}
                    value={`${ref.kind}:${ref.name}`}
                    chosen={isChosen(tips, ref)}
                    onSelect={() => {
                      choose({ type: "refs", refs: [{ kind: ref.kind, name: ref.name }] });
                    }}
                  >
                    {ref.name}
                  </PickerItem>
                ))}
              </CommandGroup>
            ))}
            {hidden > 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {hidden} more; type to narrow the list.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
