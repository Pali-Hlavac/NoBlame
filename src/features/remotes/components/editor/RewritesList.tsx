import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import type { Draft } from "../../lib/settings/draft";
import { rewrites } from "../../lib/settings/rewrites";

/** Address rewrites, read-only: they live in the user's settings mostly and affect every remote. */
export function RewritesList({ base, draft }: { base: RemoteSettingsDto; draft: Draft }) {
  const list = rewrites(base, draft);
  return (
    <section aria-labelledby="advanced-rewrites" className="grid gap-2">
      <div>
        <h3 id="advanced-rewrites" className="text-sm font-semibold">
          Address rewrites
        </h3>
        <p className="text-xs text-muted-foreground">
          <code className="font-mono">url.&lt;base&gt;.insteadOf</code> rules make git read the
          start of an address as another, for every remote. Change them in Settings → Git settings.
        </p>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rewrites are set.</p>
      ) : (
        <ul className="grid gap-1 text-sm">
          {list.map((rewrite) => (
            <li key={`${rewrite.base}\n${rewrite.prefix}\n${String(rewrite.push)}`}>
              <code className="font-mono">{rewrite.prefix}…</code> is read as{" "}
              <code className="font-mono">{rewrite.base}…</code>
              {rewrite.push ? " when pushing" : ""}{" "}
              <span className="text-xs text-muted-foreground">({rewrite.where})</span>
              {rewrite.applies ? (
                <span className="ml-2 rounded bg-muted px-1.5 text-xs">applies to {base.name}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
