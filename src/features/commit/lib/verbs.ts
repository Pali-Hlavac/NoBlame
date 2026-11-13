/** What a Commit list's buttons do: stage or unstage, with their icons. */
import {
  ChevronsDownIcon,
  ChevronsUpIcon,
  MinusIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react";

/** What the list's buttons do: "Stage" or "Unstage", with their icons. */
export interface StagingVerb {
  label: string;
  /** Shown while git moves files out of this list, e.g. "Staging…". */
  working: string;
  icon: LucideIcon;
  allIcon: LucideIcon;
}

export const STAGE: StagingVerb = {
  label: "Stage",
  working: "Staging…",
  icon: PlusIcon,
  allIcon: ChevronsDownIcon,
};

export const UNSTAGE: StagingVerb = {
  label: "Unstage",
  working: "Unstaging…",
  icon: MinusIcon,
  allIcon: ChevronsUpIcon,
};
