import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpenIcon, XIcon } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";

import type { RemoteSettingsDto } from "@/shared/ipc/bindings";
import { Button } from "@/shared/ui/button";

import type { Draft } from "../../lib/settings/draft";
import { remoteSetting } from "../../lib/settings/registry";
import { FIELD } from "../form";
import { SettingRow } from "./SettingRow";

interface SshKeySettingProps {
  base: RemoteSettingsDto;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

/** The private key NoBlame uses for this remote (its own setting, saved with the rest). */
export function SshKeySetting({ base, draft, onChange }: SshKeySettingProps) {
  const id = useId();
  const key = draft.sshKey ?? "";
  const set = (next: string) => {
    onChange({ ...draft, sshKey: next === "" ? null : next });
  };
  return (
    <SettingRow setting={remoteSetting("sshKey")} remote={base.name} controlId={id}>
      <div className="flex gap-2">
        <input
          id={id}
          value={key}
          placeholder="Not set: ssh uses its agent and ~/.ssh/config"
          spellCheck={false}
          autoComplete="off"
          className={`${FIELD} flex-1 font-mono`}
          onChange={(event) => {
            set(event.target.value);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            open({ multiple: false, directory: false, title: "Choose the SSH private key" })
              .then((chosen) => {
                if (typeof chosen === "string") set(chosen);
              })
              .catch((error: unknown) => {
                toast.error("Could not show the file picker", { description: String(error) });
              });
          }}
        >
          <FolderOpenIcon aria-hidden />
          Browse…
        </Button>
        {key ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Use no key of its own"
            title="Use no key of its own"
            onClick={() => {
              set("");
            }}
          >
            <XIcon aria-hidden />
          </Button>
        ) : null}
      </div>
      {key.endsWith(".pub") ? (
        <p className="text-xs text-destructive">
          That is the public key. Choose the private one: the same name without .pub.
        </p>
      ) : null}
    </SettingRow>
  );
}
