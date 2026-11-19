import { CloudDownloadIcon, Trash2Icon } from "lucide-react";
import { useId } from "react";

import { useGitInfo } from "@/features/git-env";
import { useRepositoryPath } from "@/features/repositories";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import { startAskDefaultBranch } from "../../api/connection";
import { type Draft, inheritedValues, setValues, valuesOf } from "../../lib/settings/draft";
import { gitRelease, remoteSetting, supports } from "../../lib/settings/registry";
import { FIELD } from "../form";
import { SettingRow } from "./SettingRow";
import { UrlActions } from "./UrlActions";
import { ValuesEditor } from "./ValuesEditor";

interface GeneralTabProps {
  repoId: number;
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  problems: ReadonlyMap<string, string>;
  /** Whether the editor has unsaved changes. */
  dirty: boolean;
  onRemove: () => void;
}

/** What `remote.<name>.followRemoteHEAD` can say, in words (git's default first). */
const FOLLOW_CHOICES = [
  ["", "Set it here when it is not set yet (git's default)"],
  ["always", "Always change it to the server's"],
  ["warn", "Keep it, and warn when they differ"],
  ["never", "Keep it, without a word"],
] as const;

function Problem({ text }: { text: string | undefined }) {
  return text ? <p className="text-xs text-destructive">{text}</p> : null;
}

/** Name, URLs, default branch; removing the remote. */
export function GeneralTab(props: GeneralTabProps) {
  const { repoId, base, draft, onChange, problems, onRemove } = props;
  const id = useId();
  const path = useRepositoryPath(repoId);
  const release = gitRelease(useGitInfo().data?.version);
  const key = (name: string) => `remote.${base.name}.${name}`;
  const urls = valuesOf(base, draft, key("url"));
  const pushUrls = valuesOf(base, draft, key("pushurl"));
  const follow = remoteSetting("followRemoteHEAD");
  const followValue = valuesOf(base, draft, key("followRemoteHEAD")).at(-1) ?? "";
  const followKnown = FOLLOW_CHOICES.some(([value]) => value === followValue);
  const branches =
    draft.head !== null && !base.branches.includes(draft.head)
      ? [draft.head, ...base.branches]
      : base.branches;

  return (
    <div className="grid gap-5">
      <SettingRow setting={remoteSetting("name")} remote={base.name} controlId={`${id}-name`}>
        <input
          id={`${id}-name`}
          value={draft.name}
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} font-mono`}
          onChange={(event) => {
            onChange({ ...draft, name: event.target.value });
          }}
        />
        <Problem text={problems.get("name")} />
      </SettingRow>
      <SettingRow setting={remoteSetting("url")} remote={base.name} controlId={`${id}-url`}>
        <input
          id={`${id}-url`}
          value={urls[0] ?? ""}
          placeholder="https://… or git@host:owner/repo.git"
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} font-mono`}
          onChange={(event) => {
            onChange(setValues(base, draft, key("url"), [event.target.value, ...urls.slice(1)]));
          }}
        />
        <Problem text={problems.get("url")} />
        {urls.length > 1 ? (
          <p className="text-xs text-muted-foreground">
            {urls.length - 1} more URL{urls.length === 2 ? "" : "s"} (Advanced tab): fetching uses
            the first; without push URLs, pushing goes to all of them.
          </p>
        ) : null}
      </SettingRow>
      <UrlActions
        repoId={repoId}
        base={base}
        draft={draft}
        onChange={onChange}
        dirty={props.dirty}
      />
      <SettingRow setting={remoteSetting("pushurl")} remote={base.name} controlId={`${id}-push`}>
        <ValuesEditor
          label="Push URL"
          firstId={`${id}-push`}
          values={pushUrls}
          placeholder="https://… or git@host:owner/repo.git"
          addLabel="Add a push URL"
          empty="Pushing goes to the URL above."
          onChange={(values) => {
            onChange(setValues(base, draft, key("pushurl"), values));
          }}
        />
        <Problem text={problems.get("pushurl")} />
      </SettingRow>
      <SettingRow setting={remoteSetting("head")} remote={base.name} controlId={`${id}-head`}>
        <div className="flex gap-2">
          <select
            id={`${id}-head`}
            value={draft.head ?? ""}
            className={`${FIELD} flex-1`}
            onChange={(event) => {
              onChange({ ...draft, head: event.target.value || null });
            }}
          >
            <option value="">Not set</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            title="Sets it to the server's default branch now (git remote set-head --auto)"
            disabled={path === undefined || props.dirty}
            onClick={() => {
              if (path !== undefined) startAskDefaultBranch(path, base.name);
            }}
          >
            <CloudDownloadIcon aria-hidden />
            Ask the server
          </Button>
        </div>
        {base.branches.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Fetch the remote first: its branches are listed once they are here.
          </p>
        ) : null}
      </SettingRow>
      <SettingRow
        setting={follow}
        remote={base.name}
        controlId={`${id}-follow`}
        inherited={followValue ? [] : inheritedValues(base, key("followRemoteHEAD"))}
        unavailable={
          supports(release, follow.since)
            ? undefined
            : `Needs git ${(follow.since ?? []).join(".")} or later; NoBlame runs git ${release?.join(".") ?? "(unknown)"}.`
        }
      >
        <select
          id={`${id}-follow`}
          value={followValue}
          disabled={!supports(release, follow.since)}
          className={FIELD}
          onChange={(event) => {
            const value = event.target.value;
            onChange(setValues(base, draft, key("followRemoteHEAD"), value ? [value] : []));
          }}
        >
          {FOLLOW_CHOICES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
          {followKnown ? null : <option value={followValue}>{followValue}</option>}
        </select>
      </SettingRow>
      <div className="border-t border-border pt-4">
        <Button type="button" variant="outline" className="text-destructive" onClick={onRemove}>
          <Trash2Icon aria-hidden />
          Remove {base.name}…
        </Button>
      </div>
    </div>
  );
}
