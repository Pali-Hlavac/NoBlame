import { PackageIcon } from "lucide-react";
import { useState } from "react";

import type { SubmoduleDto } from "@/shared/ipc/bindings";

import { openRepositories } from "../hooks/useOpenRepository";
import { RepositoryTreeRow } from "./RepositoryTreeRow";

/** Milestone that adds initializing and updating submodules. */
const SUBMODULE_ACTIONS_MILESTONE = "M7";

/** A submodule and, expanded by default, its own submodules. */
export function SubmoduleNode({ submodule, depth }: { submodule: SubmoduleDto; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = submodule.children.length > 0;
  const title = submodule.initialized
    ? `${submodule.workDir}${submodule.url ? `\n${submodule.url}` : ""}`
    : `${submodule.path} is not initialized (initializing arrives in ${SUBMODULE_ACTIONS_MILESTONE})`;
  return (
    <li>
      <RepositoryTreeRow
        icon={PackageIcon}
        label={submodule.path}
        title={title}
        depth={depth}
        expanded={hasChildren ? expanded : undefined}
        onToggle={() => {
          setExpanded(!expanded);
        }}
        onOpen={
          submodule.initialized
            ? () => {
                openRepositories([submodule.workDir]);
              }
            : undefined
        }
        dimmed={!submodule.initialized}
      />
      {hasChildren && expanded && (
        <SubmoduleList submodules={submodule.children} depth={depth + 1} />
      )}
    </li>
  );
}

export function SubmoduleList({
  submodules,
  depth,
}: {
  submodules: readonly SubmoduleDto[];
  depth: number;
}) {
  return (
    <ul>
      {submodules.map((submodule) => (
        <SubmoduleNode key={submodule.path} submodule={submodule} depth={depth} />
      ))}
    </ul>
  );
}
