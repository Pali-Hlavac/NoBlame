import { InlineError } from "@/shared/components/InlineError";

import { useRepositoryGroups } from "../api/groups";
import { GroupItem } from "./GroupItem";

/** The groups in the Repositories module, in the user's order, or a hint on how to start. */
export function RepositoryGroups() {
  const query = useRepositoryGroups();
  if (query.error) {
    return <InlineError error={query.error} className="mx-2" />;
  }
  const groups = query.data?.groups ?? [];
  if (groups.length === 0) {
    return (
      <p className="px-2 text-sm text-muted-foreground">
        No groups yet. Create one with the New group button above, then drag repositories into it.
      </p>
    );
  }
  const missing = new Set(query.data?.missing ?? []);
  return (
    <ul>
      {groups.map((group, index) => (
        <GroupItem
          key={group.id}
          group={group}
          index={index}
          count={groups.length}
          missing={missing}
        />
      ))}
    </ul>
  );
}
