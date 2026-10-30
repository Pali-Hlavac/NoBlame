/** Copying text to the clipboard with a toast saying whether it worked. */
import { toast } from "sonner";

/** Copies `text`; `what` names it in the toast ("Commit id copied"). */
export function copyToClipboard(text: string, what: string): void {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    (error: unknown) =>
      toast.error(`Could not copy the ${what.toLowerCase()}`, { description: String(error) }),
  );
}
