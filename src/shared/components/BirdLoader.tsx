import { cn } from "@/shared/lib/cn";
import {
  BIRD,
  BIRD_ASPECT_RATIO,
  BIRD_VIEWBOX,
  NOTES,
  noteClass,
  noteTransform,
} from "@/shared/lib/loadingBird";

/**
 * The loading picture: a songbird chirping on a berry branch, drawn in the text colour, so it
 * is dark on the light theme and light on the dark one. Notes rise from its beak in a loop
 * (still with reduced motion; the animation is in `index.html`). Decorative: pair it with a
 * text label. Size it by height (`h-6`); the width follows the picture. The shape is in
 * `shared/lib/loadingBird.ts`.
 */
export function BirdLoader({ className }: { className?: string }) {
  return (
    <svg
      viewBox={BIRD_VIEWBOX}
      fill="currentColor"
      aria-hidden
      className={cn("bird h-10", className)}
      style={{ aspectRatio: BIRD_ASPECT_RATIO }}
    >
      <path transform={BIRD.transform} d={BIRD.d} />
      {NOTES.map((note) => (
        <g key={note.d} transform={noteTransform(note)}>
          <path className={noteClass(note)} d={note.d} />
        </g>
      ))}
    </svg>
  );
}
