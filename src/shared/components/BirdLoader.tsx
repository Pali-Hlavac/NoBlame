import {
  BIRD_MASK,
  BIRD_VIEWBOX,
  LOADING_BIRD,
  NOTES,
  noteClass,
  noteTransform,
} from "@/shared/lib/loadingBird";
import { cn } from "@/shared/lib/cn";

const ASPECT_RATIO = `${LOADING_BIRD.width} / ${LOADING_BIRD.height}`;

/**
 * The loading picture: a flat songbird on a branch, singing (`public/loading-bird.svg`, see
 * `shared/lib/loadingBird.ts` to replace it). It is painted in the text colour, so it is dark
 * on the light theme and light on the dark one; notes rise from its beak in a loop (still with
 * reduced motion). Styles in `public/loading.css`. Decorative: pair it with a text label. Size
 * it by height (`h-6`); the width follows the picture.
 */
export function BirdLoader({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("bird h-10", className)} style={{ aspectRatio: ASPECT_RATIO }}>
      <span className="bird-image" style={BIRD_MASK} />
      <svg viewBox={BIRD_VIEWBOX} fill="currentColor">
        {NOTES.map((note) => (
          <g key={note.d} transform={noteTransform(note)}>
            <path className={noteClass(note)} d={note.d} />
          </g>
        ))}
      </svg>
    </span>
  );
}
