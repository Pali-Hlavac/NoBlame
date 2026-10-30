/**
 * The loading bird, in one place for the app (`BirdLoader`) and the start screen in
 * `index.html` (generated from {@link startScreenHtml} by a plugin in `vite.config.ts`).
 *
 * To use another picture, replace `public/loading-bird.svg` (or point `image` at another file
 * in `public/`, an SVG or a PNG with transparency). Only its shape counts: it is painted in the
 * theme's text colour. Then set `width` and `height` to its size (an SVG's viewBox), and `beak`
 * to where the notes should start, in the same units.
 *
 * Pure (no DOM, no React): `vite.config.ts` imports it.
 */
export const LOADING_BIRD = {
  /** Path of the picture in `public/`. */
  image: "/loading-bird.svg",
  /** Its size, in its own units (the viewBox of an SVG, the pixels of a PNG). */
  width: 60,
  height: 40,
  /** Where the notes come out (the open beak), in the same units. */
  beak: { x: 43, y: 11 },
  /** Size of the notes: 1 suits a picture 60 units wide; scale with the picture's units. */
  noteScale: 1,
} as const;

/** One note: its shape (a path around 0,0), where it sits from the beak, and its size. */
interface Note {
  d: string;
  dx: number;
  dy: number;
  scale: number;
  /** Rises half a cycle after the first one. */
  late: boolean;
}

/** An eighth note, and two beamed ones a little further up and right. */
export const NOTES: readonly Note[] = [
  {
    d: "M1.6 4.42A1.7 1.25 -20 0 1 -1.6 5.58A1.7 1.25 -20 0 1 1.6 4.42ZM1.05 0H1.75V5H1.05ZM1.75 0C3.4 1 4.1 2.2 3.3 3.9C3.4 2.6 2.8 1.9 1.75 1.6Z",
    dx: 3,
    dy: -7,
    scale: 1,
    late: false,
  },
  {
    d: "M1.6 5.42A1.7 1.25 -20 0 1 -1.6 6.58A1.7 1.25 -20 0 1 1.6 5.42ZM6.2 4.42A1.7 1.25 -20 0 1 3 5.58A1.7 1.25 -20 0 1 6.2 4.42ZM1.05 1H1.75V6H1.05ZM5.65 0H6.35V5H5.65ZM1.05 1L6.35 0L6.35 1.4L1.05 2.4Z",
    dx: 8,
    dy: -12,
    scale: 0.9,
    late: true,
  },
];

/** SVG `transform` placing `note` next to the beak. */
export function noteTransform(note: Note): string {
  const { beak, noteScale } = LOADING_BIRD;
  const x = beak.x + note.dx * noteScale;
  const y = beak.y + note.dy * noteScale;
  return `translate(${x} ${y}) scale(${note.scale * noteScale})`;
}

/** Class names of a note's animation (`.bird-note` in `index.html`). */
export function noteClass(note: Note): string {
  return note.late ? "bird-note bird-note-late" : "bird-note";
}

/** The `viewBox` of the picture and its notes. */
export const BIRD_VIEWBOX = `0 0 ${LOADING_BIRD.width} ${LOADING_BIRD.height}`;

/** CSS that paints the picture in the text colour (it is a mask over `currentColor`). */
export const BIRD_MASK = {
  maskImage: `url(${LOADING_BIRD.image})`,
  WebkitMaskImage: `url(${LOADING_BIRD.image})`,
} as const;

/** The start screen's markup: the bird with its notes and "Starting…" (see `index.html`). */
export function startScreenHtml(): string {
  const notes = NOTES.map(
    (note) =>
      `<g transform="${noteTransform(note)}"><path class="${noteClass(note)}" d="${note.d}" /></g>`,
  ).join("");
  const mask = `mask-image: url(${LOADING_BIRD.image}); -webkit-mask-image: url(${LOADING_BIRD.image})`;
  return [
    `<div class="boot-screen" role="status" aria-live="polite">`,
    `<span class="bird" aria-hidden="true" style="aspect-ratio: ${LOADING_BIRD.width} / ${LOADING_BIRD.height}">`,
    `<span class="bird-image" style="${mask}"></span>`,
    `<svg viewBox="${BIRD_VIEWBOX}" fill="currentColor">${notes}</svg>`,
    `</span>`,
    `<p>Starting…</p>`,
    `</div>`,
  ].join("");
}
