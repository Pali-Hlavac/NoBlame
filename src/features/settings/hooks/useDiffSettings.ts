import type { AppSettings } from "../lib/defaults";
import { useAppSettings, useChangeSettings } from "./useAppSettings";

/** The diff tab's settings and a function that saves a change to some of them. */
export function useDiffSettings(): [
  AppSettings["diff"],
  (change: Partial<AppSettings["diff"]>) => void,
] {
  const { diff } = useAppSettings();
  const changeSettings = useChangeSettings();
  return [
    diff,
    (change) => {
      changeSettings((current) => ({ ...current, diff: { ...current.diff, ...change } }));
    },
  ];
}
