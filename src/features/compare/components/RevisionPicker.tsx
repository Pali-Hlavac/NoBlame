import { ChevronDownIcon, CornerDownLeftIcon, FolderOpenIcon, GitBranchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { headNameOf, pickerSections, refRevision, useRefs } from "@/features/graph";
import { WORKING_TREE } from "@/features/selection";
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

import { revisionLabel } from "../lib/revisions";

interface RevisionPickerProps {
  repoId: number;
  /** Which side this is, for screen readers ("Compare from"). */
  side: string;
  revision: string;
  /** The commit it names, shown as the tooltip. */
  detail: string | undefined;
  /** Offer the working tree (the second side only). */
  withWorkingTree?: boolean;
  onChange: (revision: string) => void;
}

const TRIGGER_CLASSES =
  "flex h-7 max-w-56 min-w-0 shrink items-center gap-1.5 rounded border border-border bg-background px-2 text-sm hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Chooses one side of a comparison: a branch, a tag, or any revision typed in. */
export function RevisionPicker({
  repoId,
  side,
  revision,
  detail,
  withWorkingTree = false,
  onChange,
}: RevisionPickerProps) {
  const refs = useRefs(repoId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { sections, hidden } = useMemo(
    () => pickerSections(refs.data ?? [], query),
    [refs.data, query],
  );
  const typed = query.trim();
  const label = revision.trim() === "" ? "Choose…" : revisionLabel(revision);
  const headName = headNameOf(refs.data);
  const choose = (next: string) => {
    setOpen(false);
    setQuery("");
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${side}: ${label}`}
          title={detail ?? label}
          className={TRIGGER_CLASSES}
        >
          {revision === WORKING_TREE ? (
            <FolderOpenIcon className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <GitBranchIcon className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className={cn("truncate", revision.trim() === "" && "text-muted-foreground")}>
            {label}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false} label={side}>
          <CommandInput
            placeholder="Branch, tag, commit id or HEAD~2…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{refs.isPending ? "Reading branches…" : "Type a revision."}</CommandEmpty>
            {typed !== "" && (
              <CommandGroup>
                <CommandItem
                  value={`typed:${typed}`}
                  onSelect={() => {
                    choose(typed);
                  }}
                >
                  <CornerDownLeftIcon aria-hidden />
                  <span className="truncate">Use “{typed}”</span>
                </CommandItem>
              </CommandGroup>
            )}
            {withWorkingTree && (typed === "" || "working tree".includes(typed.toLowerCase())) && (
              <CommandGroup>
                <CommandItem
                  value="working-tree"
                  onSelect={() => {
                    choose(WORKING_TREE);
                  }}
                >
                  <FolderOpenIcon aria-hidden />
                  <span className="truncate">Working tree (your files now)</span>
                </CommandItem>
              </CommandGroup>
            )}
            {(typed === "" || "head".includes(typed.toLowerCase())) && (
              <CommandGroup>
                <CommandItem
                  value="head"
                  onSelect={() => {
                    choose("HEAD");
                  }}
                >
                  <span className="truncate">
                    HEAD{headName && headName !== "HEAD" ? ` (${headName})` : ""}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {sections.map((section) => (
              <CommandGroup key={section.kind} heading={section.title}>
                {section.refs.map(({ label: ref }) => (
                  <CommandItem
                    key={ref.name}
                    value={`${ref.kind}:${ref.name}`}
                    onSelect={() => {
                      choose(refRevision(ref));
                    }}
                  >
                    <span className="truncate">{ref.name}</span>
                  </CommandItem>
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
