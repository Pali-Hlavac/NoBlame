/**
 * Task actions that just succeeded (a commit, a pull, a checkout, ...). A task window listens,
 * and closes once its own action succeeded when Settings asks for it; nothing else does.
 * Failures, conflicts and cancelled actions are never reported.
 */
export type DoneAction =
  "commit" | "pull" | "push" | "fetch" | "switch" | "merge" | "rebase" | "stash" | "clone" | "init";

type Listener = (action: DoneAction) => void;

const listeners = new Set<Listener>();

/** Reports that `action` succeeded in this window. */
export function actionDone(action: DoneAction): void {
  for (const listener of listeners) listener(action);
}

/** Calls `listener` for every action that succeeded from now on; returns the unsubscribe. */
export function onActionDone(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
