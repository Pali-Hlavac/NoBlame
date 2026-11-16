import { UserPenIcon, XIcon } from "lucide-react";
import { useId } from "react";

import { Button } from "@/shared/ui/button";

import { isAuthor } from "../lib/message";

interface AuthorLineProps {
  /** The configured author (`Name <email>`), `null` when none is set. */
  configured: string | null;
  /** The override as typed, `null` when there is none. */
  author: string | null;
  amend: boolean;
  onChange: (author: string | null) => void;
}

/**
 * Who the commit is by, as a small button beside the options: the configured author in its
 * tooltip; clicking it types someone else (the author line below).
 */
export function AuthorButton({ configured, amend, onChange }: Omit<AuthorLineProps, "author">) {
  const who = amend ? "kept from the last commit" : (configured ?? "not configured");
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-6"
      aria-label="Change the author"
      title={`Author: ${who}. Click to commit as someone else.`}
      onClick={() => {
        onChange("");
      }}
    >
      <UserPenIcon aria-hidden />
    </Button>
  );
}

/** Someone else as the author, typed as `Name <email>`; × goes back to the configured one. */
export function AuthorLine({ configured, author, onChange }: AuthorLineProps) {
  const id = useId();
  if (author === null) return null;
  const invalid = author.trim() !== "" && !isAuthor(author);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <label htmlFor={`${id}-author`} className="shrink-0 text-xs text-muted-foreground">
          Author
        </label>
        <input
          id={`${id}-author`}
          value={author}
          placeholder="Name <email>"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-problem` : undefined}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
          // Empty only right after Change was clicked; a remount with a typed author stays put.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={author === ""}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Use the configured author"
          title={configured ? `Back to ${configured}` : "Back to the configured author"}
          onClick={() => {
            onChange(null);
          }}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      {invalid && (
        <span id={`${id}-problem`} className="text-xs text-destructive">
          Write it as Name &lt;email&gt;.
        </span>
      )}
    </div>
  );
}
