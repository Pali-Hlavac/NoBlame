import { KeyRoundIcon, MoveRightIcon } from "lucide-react";
import { toast } from "sonner";

import { InlineError } from "@/shared/components/InlineError";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { useMovePasswords } from "../../api/connection";
import type { Draft } from "../../lib/settings/draft";
import { moveUrlSettings, staleUrlSettings } from "../../lib/settings/urlKeyed";

interface UrlNoticesProps {
  repoId: number;
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  dirty: boolean;
}

const NOTICE = "grid gap-1.5 rounded-md border border-border bg-muted/40 p-2 text-xs";

/** A password written into the URLs, and address-keyed settings a URL change leaves behind. */
export function UrlNotices({ repoId, base, draft, onChange, dirty }: UrlNoticesProps) {
  const move = useMovePasswords(repoId);
  const prefix = `remote.${base.name}.`;
  const password = base.entries.some(
    (entry) =>
      entry.secret &&
      entry.scope === "local" &&
      (entry.key === `${prefix}url` || entry.key === `${prefix}pushurl`),
  );
  const stale = staleUrlSettings(base, draft);
  return (
    <>
      {password ? (
        <div className={NOTICE}>
          <p>
            A password is written into an address of {base.name}: git keeps it in plain text in
            .git/config. The credential helper keeps it safer, and the address keeps only the user
            name.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            disabled={dirty || move.isPending}
            onClick={() => {
              move.mutate(base.name, {
                onSuccess: (count) => {
                  toast.success(
                    `Moved ${String(count)} password${count === 1 ? "" : "s"} to the credential helper`,
                  );
                },
              });
            }}
          >
            <KeyRoundIcon aria-hidden />
            {move.isPending ? "Moving…" : "Move it to the credential helper"}
          </Button>
          {dirty ? <p>Save or discard your changes first.</p> : null}
          {move.error ? <InlineError error={move.error} /> : null}
        </div>
      ) : null}
      {stale.length > 0 ? (
        <div className={NOTICE}>
          <p>
            These settings of this repository are for the old server and stop applying when the URL
            moves:
          </p>
          <ul className="font-mono">
            {stale.map((setting) => (
              <li key={setting.key}>{setting.key}</li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => {
              onChange(moveUrlSettings(base, draft, stale));
            }}
          >
            <MoveRightIcon aria-hidden />
            Move them to the new server
          </Button>
        </div>
      ) : null}
    </>
  );
}
