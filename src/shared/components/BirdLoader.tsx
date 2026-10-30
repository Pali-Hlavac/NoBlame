import { useId } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * The loading picture: a flat songbird on a branch, singing. Its notes rise from the beak in a
 * loop (still with reduced motion). Drawn in the text colour, so it is dark on the light theme
 * and light on the dark one; decorative, so pair it with a text label.
 */
export function BirdLoader({ className }: { className?: string }) {
  // The eye and the wing are cut out of the body, so they show what is behind.
  const mask = `bird-cutouts-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      viewBox="0 0 60 40"
      fill="currentColor"
      aria-hidden
      className={cn("h-10 w-15 overflow-visible", className)}
    >
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="60" height="40">
          <rect width="60" height="40" fill="white" />
          <circle cx="31.6" cy="11.4" r="1.25" fill="black" />
          <path
            d="M21 15.5C26 16.5 30 20 30.5 25C27 25.5 22 25 17.5 27.5"
            fill="none"
            stroke="black"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <path
        mask={`url(#${mask})`}
        d="M24 9.5C27 6 34 6 36 11C37.5 14 37 17 36 19C35.5 24 31.5 29 24.5 29.5C21.5 29.7 19.3 29.2 17.5 28.5L8 35.5L5.5 33L15.5 25C15.5 19 19 13 24 9.5Z"
      />
      {/* The beak, open. */}
      <path d="M35.6 11.2L42.6 9.6L36.3 13.6Z" />
      <path d="M36.2 15L41.6 17.4L35.8 16.9Z" />
      {/* Legs, and the branch with a commit at each end. */}
      <path
        d="M24.5 29L23.5 34.5M28.5 28.6L28.5 34.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M14 35L44 35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="35" r="2" />
      <circle cx="44" cy="35" r="2" />
      <g transform="translate(46 4)">
        <g className="bird-note">
          <ellipse cx="0" cy="5" rx="1.7" ry="1.25" transform="rotate(-20 0 5)" />
          <rect x="1.05" y="0" width="0.7" height="5" />
          <path d="M1.75 0C3.4 1 4.1 2.2 3.3 3.9C3.4 2.6 2.8 1.9 1.75 1.6Z" />
        </g>
      </g>
      <g transform="translate(51 -1) scale(0.9)">
        <g className="bird-note bird-note-late">
          <ellipse cx="0" cy="6" rx="1.7" ry="1.25" transform="rotate(-20 0 6)" />
          <ellipse cx="4.6" cy="5" rx="1.7" ry="1.25" transform="rotate(-20 4.6 5)" />
          <rect x="1.05" y="1" width="0.7" height="5" />
          <rect x="5.65" y="0" width="0.7" height="5" />
          <path d="M1.05 1L6.35 0L6.35 1.4L1.05 2.4Z" />
        </g>
      </g>
    </svg>
  );
}
