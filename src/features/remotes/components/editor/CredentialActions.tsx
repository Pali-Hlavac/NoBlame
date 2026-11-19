import { KeyRoundIcon, LogOutIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useRepositoryPath } from "@/features/repositories";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import { startTestConnection, useForgetCredentials } from "../../api/connection";
import { remoteSetting } from "../../lib/settings/registry";
import { useHighlight } from "./highlight";

interface CredentialActionsProps {
  repoId: number;
  remote: string;
  server: string;
  /** Whether the editor has unsaved changes (signing in uses the saved settings). */
  dirty: boolean;
}

/** Sign in (a connection test the helper answers) and Forget the saved sign-in. */
export function CredentialActions({ repoId, remote, server, dirty }: CredentialActionsProps) {
  const path = useRepositoryPath(repoId);
  const setting = remoteSetting("credentialActions");
  const marked = useHighlight(setting.id);
  const forget = useForgetCredentials(repoId);
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      data-setting-id={setting.id}
      className={cn("-mx-2 grid gap-1 rounded-md px-2 py-1", marked)}
    >
      <span className="text-sm font-medium">{setting.label}</span>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={path === undefined}
          onClick={() => {
            if (path !== undefined) startTestConnection(path, remote);
          }}
        >
          <KeyRoundIcon aria-hidden />
          Sign in
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setConfirming(true);
          }}
        >
          <LogOutIcon aria-hidden />
          Forget the saved sign-in…
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {setting.help}
        {dirty ? " Signing in uses the saved settings: save your changes first." : ""}
      </p>
      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open);
          if (!open) forget.reset();
        }}
        title={`Forget the sign-in for ${remote}?`}
        description={`The credential helpers drop the password or token they keep for ${remote}'s addresses on ${server}. The next fetch or push asks you to sign in again. Other repositories on that server usually share it, so they ask again too.`}
        confirmLabel="Forget"
        destructive
        pending={forget.isPending}
        error={forget.error}
        onConfirm={() => {
          forget.mutate(remote, {
            onSuccess: () => {
              setConfirming(false);
              toast.success(`Forgot the sign-in for ${remote}`);
            },
          });
        }}
      />
    </div>
  );
}
