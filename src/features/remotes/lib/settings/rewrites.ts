/** The `url.<base>.insteadOf` rules git knows, and whether they change a remote's URLs. */
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import { type Draft, valuesOf } from "./draft";
import { scopeName } from "./words";

const REWRITE = /^url\.(.+)\.(insteadof|pushinsteadof)$/;

export interface Rewrite {
  /** What the address is read as. */
  base: string;
  /** The start of addresses it replaces. */
  prefix: string;
  /** Only when pushing (`pushInsteadOf`). */
  push: boolean;
  /** The settings file it is in, in words. */
  where: string;
  /** Whether it changes one of the remote's URLs. */
  applies: boolean;
}

export function rewrites(base: RemoteSettingsDto, draft: Draft): Rewrite[] {
  const urls = valuesOf(base, draft, `remote.${base.name}.url`);
  const pushUrls = valuesOf(base, draft, `remote.${base.name}.pushurl`);
  return base.entries.flatMap((entry) => {
    const match = REWRITE.exec(entry.key);
    if (!match?.[1]) return [];
    const push = match[2] === "pushinsteadof";
    const targets = push && pushUrls.length > 0 ? pushUrls : urls;
    return [
      {
        base: match[1],
        prefix: entry.value,
        push,
        where: `${scopeName(entry.scope)}${entry.file ? ` (${entry.file})` : ""}`,
        applies: entry.value !== "" && targets.some((url) => url.startsWith(entry.value)),
      },
    ];
  });
}
