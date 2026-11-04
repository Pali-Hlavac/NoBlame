import { ChevronDownIcon, FileTextIcon, HistoryIcon } from "lucide-react";
import { useState } from "react";

import { toIpcError } from "@/shared/ipc/client";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import { useRecentMessages } from "../api/commit";

interface MessageMenuProps {
  repoId: number;
  /** The `commit.template` text, when one is configured and readable. */
  template: string | null;
  onTemplate: () => void;
  onRecent: (message: string) => void;
}

function firstLine(message: string): string {
  return message.split("\n", 1)[0] ?? "";
}

/** The user's recent messages (read when the menu opens) and the template, to start from. */
export function MessageMenu({ repoId, template, onTemplate, onRecent }: MessageMenuProps) {
  const [open, setOpen] = useState(false);
  const recent = useRecentMessages(repoId, open);
  const messages = recent.data ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
          <HistoryIcon aria-hidden />
          Recent
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[min(32rem,90vw)]">
        <DropdownMenuLabel>Your recent messages</DropdownMenuLabel>
        {recent.isPending && <DropdownMenuItem disabled>Reading…</DropdownMenuItem>}
        {recent.error && (
          <DropdownMenuItem disabled>{toIpcError(recent.error).message}</DropdownMenuItem>
        )}
        {recent.isSuccess && messages.length === 0 && (
          <DropdownMenuItem disabled>None among the last 2,000 commits</DropdownMenuItem>
        )}
        {messages.map((message) => (
          <DropdownMenuItem
            key={message}
            title={message}
            onSelect={() => {
              onRecent(message);
            }}
          >
            <span className="truncate">{firstLine(message)}</span>
          </DropdownMenuItem>
        ))}
        {template !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onTemplate}>
              <FileTextIcon aria-hidden />
              Start from the template
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
