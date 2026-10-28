/** Layout and paging of the diff tab. */

/** Height of one diff row in CSS pixels (`leading-5`). */
export const ROW_HEIGHT_PX = 20;
/** Rows fetched per request. */
export const DIFF_PAGE_ROWS = 500;
/** Pages fetched beyond the visible ones on each side. */
export const PREFETCH_PAGES = 1;
/** Rows rendered above and below the visible ones. */
export const OVERSCAN_ROWS = 10;
/** Rows shown at most: browsers cap element heights at about 33 million pixels. */
export const MAX_SHOWN_ROWS = 1_000_000;
