/** The toast after a merge, cherry-pick or revert. */
import { toast } from "sonner";

/** The conflict toast stays a while longer than others: it says what to do next. */
const CONFLICT_TOAST_MS = 12_000;

/** What an operation's toast says, and how it looks. */
export interface Outcome {
  title: string;
  description?: string;
  tone: "success" | "info" | "warning";
}

/** What to do after an operation stopped on conflicts. */
export const CONFLICT_ADVICE =
  "Resolve them and stage them, then choose Continue in the bar above the commits (or Abort).";

/** Shows `outcome` as a toast. The bar above the commits stays while conflicts remain. */
export function showOutcome({ title, description, tone }: Outcome): void {
  if (tone === "warning") toast.warning(title, { description, duration: CONFLICT_TOAST_MS });
  else if (tone === "info") toast.info(title, { description });
  else toast.success(title, { description });
}
