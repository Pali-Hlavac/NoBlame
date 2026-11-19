import { startFetch, startJob } from "@/features/jobs";
import { useRepositoryPath } from "@/features/repositories";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";

import type { Draft } from "../../lib/settings/draft";
import type { RemoteTab } from "../../lib/settings/registry";
import { panelId, tabId } from "../../lib/settings/words";
import { AdvancedTab } from "./AdvancedTab";
import { BranchesTab } from "./BranchesTab";
import { ConnectionTab } from "./ConnectionTab";
import { FetchTab } from "./FetchTab";
import { GeneralTab } from "./GeneralTab";
import { PushTab } from "./PushTab";

interface TabPanelProps {
  repoId: number;
  idPrefix: string;
  tab: RemoteTab;
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  problems: ReadonlyMap<string, string>;
  dirty: boolean;
  /** Every remote's name, this one included. */
  remotes: readonly string[];
  onRemove: () => void;
}

/** The open tab's settings. */
export function TabPanel({ repoId, idPrefix, tab, remotes, ...props }: TabPanelProps) {
  const path = useRepositoryPath(repoId);
  const { base, draft, onChange } = props;
  const onFetch =
    path === undefined
      ? undefined
      : (prune: boolean) => {
          startJob(
            startFetch({ path, target: { type: "remote", name: base.name }, prune }),
            "fetch",
          );
        };
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, tab)}
      aria-labelledby={tabId(idPrefix, tab)}
      className="min-h-0 flex-1 overflow-auto px-3 py-1"
    >
      {tab === "general" ? (
        <GeneralTab repoId={repoId} {...props} />
      ) : tab === "fetch" ? (
        <FetchTab
          base={base}
          draft={draft}
          onChange={onChange}
          problems={props.problems}
          onFetch={onFetch}
        />
      ) : tab === "push" ? (
        <PushTab base={base} draft={draft} onChange={onChange} />
      ) : tab === "connection" ? (
        <ConnectionTab base={base} draft={draft} onChange={onChange} />
      ) : tab === "branches" ? (
        <BranchesTab base={base} draft={draft} onChange={onChange} remotes={remotes} />
      ) : (
        <AdvancedTab base={base} draft={draft} onChange={onChange} />
      )}
    </div>
  );
}
