/** Sizes and limits of the graph view. */

/** Height of one row, in CSS pixels. */
export const ROW_HEIGHT_PX = 26;
/** Horizontal distance between lanes, in CSS pixels. */
export const LANE_WIDTH_PX = 14;
/** Radius of a commit node. */
export const NODE_RADIUS_PX = 4;
/** Width of lane lines. */
export const LINE_WIDTH_PX = 1.5;
/** Space left of the first lane and right of the last one. */
export const GRAPH_PADDING_PX = 10;
/** The graph column never grows wider than this many lanes; wider graphs are clipped. */
export const MAX_VISIBLE_LANES = 16;

/** Rows of commit text fetched per request. */
export const PAGE_ROWS = 100;
/** Blocks kept in memory per repository (each about 256 rows). */
export const BLOCK_CACHE_SIZE = 96;
/** Extra blocks and pages loaded above and below the visible rows. */
export const PREFETCH_MARGIN = 1;

/**
 * Tallest scroll area used. Browsers cap element heights (Chromium at about 33.5M px, Firefox
 * at about 17.9M px), so beyond this the scroll position is scaled onto the rows.
 */
export const MAX_SCROLL_HEIGHT_PX = 10_000_000;

/** Supported version of the binary block format (`docs/architecture/ipc.md`). */
export const BLOCK_FORMAT_VERSION = 1;
/** Supported version of the highlight overlay (`get_ancestry_block`). */
export const ANCESTRY_FORMAT_VERSION = 1;
/** Highlight overlays kept per selection. */
export const ANCESTRY_CACHE_SIZE = 32;
/** Opacity of nodes and lines outside the highlighted history. */
export const DIMMED_ALPHA = 0.22;
/** Row flag: merge commit. */
export const FLAG_MERGE = 1;
/** Row flag: HEAD points here. */
export const FLAG_HEAD = 2;
/** Pause in typing after which the author and message filters apply. */
export const TEXT_FILTER_DELAY_MS = 500;
/** Pause in typing after which the find bar searches. */
export const FIND_DELAY_MS = 300;
