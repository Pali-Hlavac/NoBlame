# 0009: Canvas graph rendering and lane layout

- Status: Accepted
- Date: 2026-10-27
- Milestone: M2

## Context and problem

The graph column draws the lines of every branch and a node per commit, next to text columns
(message with ref labels, author, date, id). With a million rows and up to dozens of lanes,
creating DOM or SVG elements per commit or per line is out of the question. The layout rules decide
how readable the graph is: stable colours, merges that are easy to follow, no lines jumping
between columns.

## Decision drivers

- 60 fps scrolling with any history length.
- Readable lanes: one colour per branch for its whole length, clear merges and forks.
- Accessible text (selection, keyboard, screen readers) for the rows.
- Work within browser limits on element height.

## Considered options

1. Canvas for lanes and nodes, DOM only for the visible text rows.
2. SVG per visible row.
3. Everything on canvas, text included.

## Decision outcome

Chosen option: **1**. Lanes and nodes are pixels; text stays real, accessible DOM, but only for
the rows on screen.

**Layout** (`crates/git-core/src/graph/layout.rs`), applied to rows in date order:

- A lane waits for a commit. On that commit's row every lane waiting for it converges into its
  node (leftmost lane wins); a commit nobody waits for takes the first free lane.
- The node's lane continues with the first parent. Each further parent joins a lane that already
  waits for it, or gets the first free lane (octopus merges get one lane per extra parent).
- Freed lanes are reused; trailing empty lanes are dropped.
- A lane's colour id is assigned when it starts and never changes. The UI maps ids onto 8 CSS
  tokens (`--lane-0..7`, light and dark).

**Rendering** (`src/features/graph`):

- A scroll spacer gives the scroll bar; a sticky layer as tall as the viewport holds the canvas
  and the visible text rows. Above 10M px of content the scroll position is scaled onto the rows,
  because browsers cap element heights (about 33.5M px in Chromium, 17.9M px in Firefox).
- The canvas is HiDPI-scaled and redrawn for the visible rows only. Lines are batched into one
  stroke per colour; a lane change is a Bézier curve; HEAD gets a ring; merges are hollow.
- The graph column is capped at 16 lanes (`MAX_VISIBLE_LANES`); wider graphs are clipped so the
  message column stays readable.
- Text rows are `role="option"` elements in a `role="listbox"` with `aria-activedescendant`.

### Consequences

Good:

- Drawing cost depends on the screen, not the history: tens of rows and a few strokes per frame.
- Branch colours are stable and merges are visually distinct.
- Text is selectable, readable by screen readers and styled with the normal design tokens.

Bad:

- Canvas colours must be read from CSS tokens and re-read on theme changes (`usePalette`).
- With scaled scrolling the mouse wheel moves faster than one pixel per pixel on huge histories.
- Lanes beyond 16 are not visible until resizable columns arrive.
- Long-lived topic branches each keep a lane, so histories with many parallel branches get wide.

## Pros and cons of the options

### Option 2: SVG per row

- Good: crisp, easy to style.
- Bad: hundreds of DOM nodes per screen; slower than one canvas.

### Option 3: everything on canvas

- Good: fastest possible drawing.
- Bad: no text selection or accessibility without re-implementing them; harder text layout.

## Links

- [ADR 0008](0008-binary-graph-blocks.md)
- [commit-graph.md](../architecture/commit-graph.md), [features/commit-graph.md](../features/commit-graph.md)
