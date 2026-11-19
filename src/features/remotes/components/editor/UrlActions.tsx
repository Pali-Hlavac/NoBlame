import { ArrowLeftRightIcon, ExternalLinkIcon, PlugZapIcon } from "lucide-react";
import { toast } from "sonner";

import { useRepositoryPath } from "@/features/repositories";
import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { openWebPage, startTestConnection } from "../../api/connection";
import { type Draft, localValues, setValues, valuesOf } from "../../lib/settings/draft";
import { otherProtocol, webPage } from "../../lib/settings/hosts";
import { remoteSetting } from "../../lib/settings/registry";
import { useHighlight } from "./highlight";
import { UrlNotices } from "./UrlNotices";

interface UrlActionsProps {
  repoId: number;
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
  /** Whether the editor has unsaved changes. */
  dirty: boolean;
}

/** Under the URL: Test connection, the other protocol, the web page; what a URL leaves behind. */
export function UrlActions({ repoId, base, draft, onChange, dirty }: UrlActionsProps) {
  const path = useRepositoryPath(repoId);
  const setting = remoteSetting("urlActions");
  const marked = useHighlight(setting.id);
  const urlKey = `remote.${base.name}.url`;
  const urls = valuesOf(base, draft, urlKey);
  const url = urls[0] ?? "";
  const changed = url !== (localValues(base, urlKey)[0] ?? "");
  const other = otherProtocol(url);
  const page = webPage(url);
  return (
    <div
      data-setting-id={setting.id}
      className={cn("-mx-2 grid gap-2 rounded-md px-2 py-1", marked)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={path === undefined}
          onClick={() => {
            if (path !== undefined) startTestConnection(path, base.name);
          }}
        >
          <PlugZapIcon aria-hidden />
          Test connection
        </Button>
        {other ? (
          <Button
            variant="outline"
            size="sm"
            title={other.url}
            onClick={() => {
              onChange(setValues(base, draft, urlKey, [other.url, ...urls.slice(1)]));
            }}
          >
            <ArrowLeftRightIcon aria-hidden />
            Use {other.kind === "ssh" ? "SSH" : "HTTPS"}
          </Button>
        ) : null}
        {page ? (
          <Button
            variant="outline"
            size="sm"
            title={page}
            onClick={() => {
              openWebPage(page).catch((error: unknown) => {
                toast.error("Could not open the web page", {
                  description: error instanceof Error ? error.message : String(error),
                });
              });
            }}
          >
            <ExternalLinkIcon aria-hidden />
            Open in browser
          </Button>
        ) : null}
      </div>
      {changed ? (
        <p className="text-xs text-muted-foreground">
          Test connection uses the saved URL; save to test the new one.
        </p>
      ) : null}
      <UrlNotices repoId={repoId} base={base} draft={draft} onChange={onChange} dirty={dirty} />
    </div>
  );
}
