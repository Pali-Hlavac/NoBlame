/** Turns the git check result into what the status bar and notices show. */
import type { GitInfo } from "@/shared/ipc/bindings";
import { toIpcError } from "@/shared/ipc/client";

export type GitStatusTone = "pending" | "ok" | "warning" | "error";

export interface GitStatus {
  tone: GitStatusTone;
  /** Short label for the status bar, e.g. "Git 2.47.1". */
  label: string;
  /** One sentence explaining the state. */
  detail: string;
  /** What the user can do, when something is wrong. */
  hint: string | null;
}

interface GitCheck {
  data?: GitInfo;
  error?: unknown;
}

/** Describes the result of `useGitInfo` for display. */
export function describeGitStatus({ data, error }: GitCheck): GitStatus {
  if (error) {
    const { message, hint } = toIpcError(error);
    return { tone: "error", label: "Git not available", detail: message, hint };
  }
  if (!data) {
    return { tone: "pending", label: "Checking git…", detail: "Looking for git.", hint: null };
  }
  if (!data.supported) {
    return {
      tone: "warning",
      label: `Git ${data.version} (too old)`,
      detail: `NoBlame needs git ${data.minimumVersion} or newer; ${data.path} is ${data.version}.`,
      hint: "Upgrade git, or set NOBLAME_GIT to a newer git executable, then check again.",
    };
  }
  return {
    tone: "ok",
    label: `Git ${data.version}`,
    detail: `Using ${data.path}.`,
    hint: null,
  };
}
