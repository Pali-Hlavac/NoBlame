/** What the Create repository window says about the folder chosen. */
import type { FolderStateDto } from "@/shared/ipc/bindings";

export interface InitAdvice {
  tone: "info" | "warning" | "error";
  text: string;
  /** Create cannot run (a file, or a repository already). */
  blocked: boolean;
}

/** Advice for creating a repository at a folder in `state`; `null` for an empty folder. */
export function initAdvice(state: FolderStateDto): InitAdvice | null {
  if (state.kind === "file") {
    return { tone: "error", text: "This is a file. Choose a folder.", blocked: true };
  }
  if (state.isRepository) {
    return { tone: "info", text: "This folder is a repository already.", blocked: true };
  }
  if (state.repository !== null) {
    return {
      tone: "warning",
      text: `It is inside the repository ${state.repository}. The new repository sits in it as a folder that repository does not track; to keep one repository inside another, add it there as a submodule.`,
      blocked: false,
    };
  }
  if (state.kind === "missing") {
    return {
      tone: "info",
      text: "The folder does not exist yet; it will be created.",
      blocked: false,
    };
  }
  if (state.kind === "filled") {
    return {
      tone: "info",
      text: "The folder has files. They stay, not committed yet: the Commit window adds them.",
      blocked: false,
    };
  }
  return null;
}
