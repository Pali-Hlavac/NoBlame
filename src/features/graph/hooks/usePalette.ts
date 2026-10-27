import { useEffect, useState } from "react";

import type { GraphPalette } from "../lib/draw";

/** Number of `--lane-N` tokens in `src/app/styles.css`. */
const LANE_TOKEN_COUNT = 8;
/** Used only if a token is missing (e.g. in tests without the stylesheet). */
const FALLBACK_COLOR = "gray";

function readPalette(): GraphPalette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim() || FALLBACK_COLOR;
  return {
    lanes: Array.from({ length: LANE_TOKEN_COUNT }, (_, index) => token(`--lane-${index}`)),
    background: token("--background"),
    head: token("--ref-head"),
  };
}

/** Lane colours from the CSS tokens, re-read whenever the theme class on `<html>` changes. */
export function usePalette(): GraphPalette {
  const [palette, setPalette] = useState(readPalette);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setPalette(readPalette());
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
    };
  }, []);
  return palette;
}
