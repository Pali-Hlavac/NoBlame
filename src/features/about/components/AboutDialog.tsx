import { useState } from "react";

import { APP_TAGLINE } from "@/app.config";
import { GitInfoRows } from "@/features/git-env";
import { UpdateCheck } from "@/features/updates";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import { useAppInfo } from "../api/appInfo";
import { useAboutStore } from "../store/about";
import { ThirdPartyNotices } from "./ThirdPartyNotices";

/** Shows the app version, platform and the git in use; handy for bug reports. */
export function AboutDialog() {
  const open = useAboutStore((state) => state.open);
  const { setOpen } = useAboutStore.getState();
  const { data: info, error, isPending, refetch } = useAppInfo();
  const [licences, setLicences] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <img src="/songbird.png" alt="" className="h-20 w-auto" />
          <DialogTitle>{info?.name ?? "About"}</DialogTitle>
          <DialogDescription>{APP_TAGLINE}</DialogDescription>
        </DialogHeader>
        {isPending && <LoadingState label="Loading version information…" />}
        {error && (
          <ErrorState
            error={error}
            title="Could not load version information"
            onRetry={() => void refetch()}
          />
        )}
        {info && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-mono">{info.version}</dd>
            <dt className="text-muted-foreground">Platform</dt>
            <dd className="font-mono">
              {info.os} / {info.arch}
            </dd>
            <GitInfoRows />
          </dl>
        )}
        <UpdateCheck />
        <Button
          variant="outline"
          size="sm"
          className="justify-self-center"
          onClick={() => {
            setLicences(true);
          }}
        >
          Third-party licences…
        </Button>
        <ThirdPartyNotices open={licences} onOpenChange={setLicences} />
      </DialogContent>
    </Dialog>
  );
}
