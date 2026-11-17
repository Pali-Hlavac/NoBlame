import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useThirdPartyNotices } from "../api/appInfo";
import { matchingSections, noticeSections } from "../lib/notices";

interface ThirdPartyNoticesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The licences of the open-source software NoBlame includes, searchable by name. */
export function ThirdPartyNotices({ open, onOpenChange }: ThirdPartyNoticesProps) {
  const [query, setQuery] = useState("");
  const notices = useThirdPartyNotices(open);
  const sections = useMemo(() => noticeSections(notices.data ?? ""), [notices.data]);
  const shown = useMemo(() => matchingSections(sections, query), [sections, query]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Third-party licences</DialogTitle>
          <DialogDescription>
            NoBlame is built with open-source software: the Rust crates, the JavaScript packages and
            the syntax grammars below, each with its licence. The same text is installed beside
            NoBlame as third-party-notices.txt.
          </DialogDescription>
        </DialogHeader>
        <label className="flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-2 text-sm focus-within:ring-2 focus-within:ring-ring">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            aria-label="Find a component or licence"
            placeholder="Find a component or licence"
            value={query}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </label>
        {notices.isPending && <LoadingState label="Loading the licences…" />}
        {notices.error && (
          <ErrorState
            error={notices.error}
            title="Could not load the licences"
            onRetry={() => void notices.refetch()}
          />
        )}
        {notices.data !== undefined && (
          <div
            role="region"
            aria-label="Licences"
            // A scrolling region must take focus so the keyboard can scroll it (WCAG 2.1.1).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/30 p-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing matches “{query}”.</p>
            ) : (
              shown.map((section, index) => (
                <pre
                  key={index}
                  className="border-b border-border pb-3 font-mono text-xs whitespace-pre-wrap last:border-b-0 [&+&]:pt-3"
                >
                  {section}
                </pre>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
