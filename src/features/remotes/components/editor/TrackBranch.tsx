import { PlusIcon } from "lucide-react";
import { useState } from "react";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { FIELD } from "../form";

/** Choosing a local branch that does not track the remote yet, and its upstream there. */
export function TrackBranch(props: {
  base: RemoteSettingsDto;
  taken: readonly string[];
  onTrack: (branch: string, upstream: string) => void;
}) {
  const { base } = props;
  const free = base.localBranches.filter((branch) => !props.taken.includes(branch));
  const [branch, setBranch] = useState("");
  const [upstream, setUpstream] = useState("");
  if (free.length === 0 || base.branches.length === 0) return null;
  const chosen = branch || (free[0] ?? "");
  const target =
    upstream || (base.branches.includes(chosen) ? chosen : (base.head ?? base.branches[0] ?? ""));
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span>Make</span>
      <select
        aria-label="Branch to track this remote"
        className={FIELD}
        value={chosen}
        onChange={(event) => {
          setBranch(event.target.value);
          setUpstream("");
        }}
      >
        {free.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <span>track {base.name}/</span>
      <select
        aria-label="Its upstream"
        className={FIELD}
        value={target}
        onChange={(event) => {
          setUpstream(event.target.value);
        }}
      >
        {base.branches.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          props.onTrack(chosen, target);
        }}
      >
        <PlusIcon aria-hidden />
        Track
      </Button>
    </div>
  );
}
