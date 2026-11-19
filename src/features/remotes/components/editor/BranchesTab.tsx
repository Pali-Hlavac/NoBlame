import { useId } from "react";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";

import { type Draft, effectiveValue, setValues, valuesOf } from "../../lib/settings/draft";
import { remoteSetting } from "../../lib/settings/registry";
import {
  BRANCH_PULL_CHOICES,
  branchKey,
  PULL_FF_CHOICES,
  PULL_REBASE_CHOICES,
  setUpstream,
  trackingBranches,
  upstreamOf,
} from "../../lib/settings/tracking";
import { FIELD } from "../form";
import { ChoiceSetting } from "./ChoiceSetting";
import { useHighlight } from "./highlight";
import { TrackBranch } from "./TrackBranch";

interface BranchesTabProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  /** Every remote's name, this one included. */
  remotes: readonly string[];
}

/** The local branches tracking this remote; how the repository pulls. */
export function BranchesTab({ base, draft, onChange, remotes }: BranchesTabProps) {
  const id = useId();
  const setting = remoteSetting("upstreams");
  const marked = useHighlight(setting.id);
  const tracking = trackingBranches(base, draft);
  const pushDefault = effectiveValue(base, draft, "remote.pushDefault");
  const shared = { base, draft, onChange };

  return (
    <div className="grid gap-5">
      <section
        data-setting-id={setting.id}
        aria-labelledby={`${id}-title`}
        className={cn("-mx-2 grid gap-2 rounded-md px-2 py-1", marked)}
      >
        <div>
          <h3 id={`${id}-title`} className="text-sm font-medium">
            Branches that track {base.name}
          </h3>
          <p className="text-xs text-muted-foreground">{setting.help}</p>
        </div>
        {tracking.length === 0 ? (
          <p className="text-sm text-muted-foreground">No branch tracks {base.name} yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Branch</th>
                <th className="py-1 font-medium">Upstream on {base.name}</th>
                <th className="py-1 font-medium">Push to</th>
                <th className="py-1 font-medium">Pull by</th>
              </tr>
            </thead>
            <tbody>
              {tracking.map((branch) => (
                <BranchRow
                  key={branch}
                  {...shared}
                  branch={branch}
                  remotes={remotes}
                  pushDefault={pushDefault}
                />
              ))}
            </tbody>
          </table>
        )}
        <TrackBranch
          base={base}
          taken={tracking}
          onTrack={(branch, upstream) => {
            onChange(setUpstream(base, draft, branch, upstream));
          }}
        />
      </section>
      <section aria-labelledby={`${id}-pull`} className="grid gap-5 border-t border-border pt-4">
        <div>
          <h3 id={`${id}-pull`} className="text-sm font-semibold">
            Pulling, for every branch of this repository
          </h3>
          <p className="text-xs text-muted-foreground">
            Branches that say how they pull (above) do it their way.
          </p>
        </div>
        <ChoiceSetting
          id="pullRebase"
          {...shared}
          unset="Not set (git asks you to choose when both sides changed)"
          choices={PULL_REBASE_CHOICES}
        />
        <ChoiceSetting
          id="pullFf"
          {...shared}
          unset="Not set (fast-forward when possible)"
          choices={PULL_FF_CHOICES}
        />
      </section>
    </div>
  );
}

function BranchRow(props: {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  branch: string;
  remotes: readonly string[];
  pushDefault: string | undefined;
}) {
  const { base, draft, onChange, branch } = props;
  const upstream = upstreamOf(base, draft, branch);
  const options =
    upstream && !base.branches.includes(upstream) ? [upstream, ...base.branches] : base.branches;
  const pushRemote = valuesOf(base, draft, branchKey(branch, "pushRemote")).at(-1) ?? "";
  const rebase = valuesOf(base, draft, branchKey(branch, "rebase")).at(-1) ?? "";
  const set = (name: string, value: string) => {
    onChange(setValues(base, draft, branchKey(branch, name), value ? [value] : []));
  };
  return (
    <tr className="border-t border-border">
      <td className="py-1.5 pr-2 font-mono">{branch}</td>
      <td className="py-1.5 pr-2">
        <select
          aria-label={`Upstream of ${branch}`}
          className={cn(FIELD, "w-full")}
          value={upstream ?? ""}
          onChange={(event) => {
            onChange(setUpstream(base, draft, branch, event.target.value || null));
          }}
        >
          <option value="">Stop tracking</option>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5 pr-2">
        <select
          aria-label={`Push ${branch} to`}
          className={cn(FIELD, "w-full")}
          value={pushRemote}
          onChange={(event) => {
            set("pushRemote", event.target.value);
          }}
        >
          <option value="">{`As the repository says (${props.pushDefault ?? base.name})`}</option>
          {props.remotes.map((remote) => (
            <option key={remote} value={remote}>
              {remote}
            </option>
          ))}
        </select>
      </td>
      <td className="py-1.5">
        <select
          aria-label={`How ${branch} pulls`}
          className={cn(FIELD, "w-full")}
          value={rebase}
          onChange={(event) => {
            set("rebase", event.target.value);
          }}
        >
          <option value="">As the repository says</option>
          {BRANCH_PULL_CHOICES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
