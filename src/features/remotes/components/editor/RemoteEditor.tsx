import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/shared/components/ErrorState";
import { InlineError } from "@/shared/components/InlineError";
import { LoadingState } from "@/shared/components/LoadingState";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import {
  useApplyRemoteChanges,
  usePreviewRemoteChanges,
  useRemoteSettings,
} from "../../api/remoteSettings";
import { changeCount, type Draft, emptyDraft, toEdit } from "../../lib/settings/draft";
import { draftProblems } from "../../lib/settings/problems";
import { REMOTE_TABS, type RemoteTab } from "../../lib/settings/registry";
import { panelId, tabId } from "../../lib/settings/words";
import { AdvancedTab } from "./AdvancedTab";
import { EditorTabs } from "./EditorTabs";
import { GeneralTab } from "./GeneralTab";
import { ReviewDialog } from "./ReviewDialog";

interface RemoteEditorProps {
  repoId: number;
  name: string;
  /** The other remotes' names (a new name must differ). */
  otherRemotes: readonly string[];
  /** Told whether there are unsaved changes (switching and closing ask first). */
  onDirtyChange: (dirty: boolean) => void;
  /** After a save that renamed the remote. */
  onRenamed: (name: string) => void;
  onRemove: () => void;
}

/** One remote's settings in tabs; changes are collected, reviewed, then saved all at once. */
export function RemoteEditor(props: RemoteEditorProps) {
  const settings = useRemoteSettings(props.repoId, props.name);
  const [base, setBase] = useState<RemoteSettingsDto | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const dirty = base !== null && draft !== null && changeCount(base, draft) > 0;
  // Fresh settings replace what is shown while nothing is changed (after saving, a fetch).
  if (settings.data && settings.data !== base && (base === null || !dirty)) {
    setBase(settings.data);
    setDraft(emptyDraft(settings.data));
  }
  const { onDirtyChange } = props;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  if (settings.error) {
    return (
      <ErrorState
        error={settings.error}
        title={`Could not read the settings of ${props.name}`}
        onRetry={() => void settings.refetch()}
      />
    );
  }
  if (!base || !draft) return <LoadingState label="Reading the settings…" />;
  return (
    <Editor
      {...props}
      base={base}
      draft={draft}
      onDraft={setDraft}
      onSaved={() => {
        setBase(null);
      }}
    />
  );
}

interface EditorProps extends RemoteEditorProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  onSaved: () => void;
}

function Editor({ repoId, base, draft, onDraft, onSaved, ...props }: EditorProps) {
  const id = useId();
  const [tab, setTab] = useState<RemoteTab>("general");
  const [review, setReview] = useState<readonly string[] | null>(null);
  const preview = usePreviewRemoteChanges(repoId);
  const apply = useApplyRemoteChanges(repoId);
  const count = changeCount(base, draft);
  const problems = draftProblems(base, draft, props.otherRemotes);
  const name = draft.name.trim();

  const startReview = () => {
    preview.mutate(toEdit(base, { ...draft, name }), {
      onSuccess: (commands) => {
        if (commands.length > 0) {
          setReview(commands);
          return;
        }
        toast.info("Nothing to save: the settings are already like that.");
        onDraft(emptyDraft(base));
      },
    });
  };
  const save = () => {
    apply.mutate(toEdit(base, { ...draft, name }), {
      onSuccess: () => {
        toast.success(`Saved the settings of ${name}`);
        setReview(null);
        if (name !== base.name) props.onRenamed(name);
        else onSaved();
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <EditorTabs
        label={`Settings of ${base.name}`}
        idPrefix={id}
        tabs={REMOTE_TABS}
        value={tab}
        onChange={setTab}
      />
      <div
        role="tabpanel"
        id={panelId(id, tab)}
        aria-labelledby={tabId(id, tab)}
        className="min-h-0 flex-1 overflow-auto pr-1"
      >
        {tab === "general" ? (
          <GeneralTab
            base={base}
            draft={draft}
            onChange={onDraft}
            problems={problems}
            onRemove={props.onRemove}
          />
        ) : (
          <AdvancedTab base={base} draft={draft} onChange={onDraft} />
        )}
      </div>
      {preview.error ? <InlineError error={preview.error} /> : null}
      <div className="flex items-center gap-2 border-t border-border pt-3">
        <p className="flex-1 text-sm text-muted-foreground" aria-live="polite">
          {count === 0
            ? "No changes."
            : `${String(count)} change${count === 1 ? "" : "s"} not saved yet.`}
          {problems.size > 0 && count > 0 ? " Fix what is marked in red first." : ""}
        </p>
        <Button
          variant="outline"
          disabled={count === 0}
          onClick={() => {
            onDraft(emptyDraft(base));
            preview.reset();
          }}
        >
          Discard
        </Button>
        <Button
          disabled={count === 0 || problems.size > 0 || preview.isPending}
          onClick={startReview}
        >
          {preview.isPending ? "Checking…" : "Review and save…"}
        </Button>
      </div>
      {review ? (
        <ReviewDialog
          remote={base.name}
          commands={review}
          pending={apply.isPending}
          error={apply.error}
          onSave={save}
          onClose={() => {
            setReview(null);
            apply.reset();
          }}
        />
      ) : null}
    </div>
  );
}
