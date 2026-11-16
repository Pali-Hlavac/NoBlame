import { PackageOpenIcon } from "lucide-react";

import type { SuperprojectLabel } from "../hooks/useSuperprojectLabels";

/**
 * In a submodule's graph, on a commit the superproject's branches record: their names, in the
 * submodules' colour, outlined (they are not this repository's references).
 */
export function SuperprojectBadge({ label }: { label: SuperprojectLabel }) {
  const names = label.branches.join(", ");
  const verb = label.branches.length === 1 ? "records" : "record";
  return (
    <span
      title={`In ${label.superproject}, ${names} ${verb} this commit`}
      className="inline-flex max-w-48 shrink-0 items-center gap-1 rounded px-1.5 text-xs leading-5 text-kind-submodules ring-1 ring-kind-submodules/60 ring-inset"
    >
      <PackageOpenIcon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">
        {label.superproject}: {names}
      </span>
    </span>
  );
}
