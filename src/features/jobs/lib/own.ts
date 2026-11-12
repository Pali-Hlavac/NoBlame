/**
 * The jobs this window started. Job events reach every window (the main window and task
 * windows); only the window that started a job opens the Git output window for it and tells how
 * it went, so a pull in a task window does not also pop up in the main window.
 */
const own = new Set<number>();
/** Jobs whose first event came before their start returned their id. */
const early = new Set<number>();
let onLate: ((id: number) => void) | null = null;

/** Records that this window started job `id`. */
export function ownJob(id: number): void {
  own.add(id);
  if (early.delete(id)) onLate?.(id);
}

/** Whether this window started job `id`; a new job not known yet is remembered as early. */
export function isOwnJob(id: number, isNew = false): boolean {
  if (own.has(id)) return true;
  if (isNew) early.add(id);
  return false;
}

/** Called for an early job once this window learns it started it (`useJobEvents`). */
export function onLateOwnJob(callback: ((id: number) => void) | null): void {
  onLate = callback;
}

/** Forgets everything (tests). */
export function forgetOwnJobs(): void {
  own.clear();
  early.clear();
}
