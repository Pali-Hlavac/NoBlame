/**
 * Initials badges for people: up to two initials from the name, and a hue from the e-mail
 * address, so a person has the same colour on every device and in every repository.
 */

/** Hues on the colour wheel. */
const HUES = 360;
/** 32-bit FNV-1a, a small fixed hash: the same input gives the same hue everywhere. */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const encoder = new TextEncoder();

/** FNV-1a of the UTF-8 bytes of `text`, as an unsigned 32-bit number. */
export function fnv1a(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of encoder.encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** The badge hue (0–359) for an e-mail address; the name when there is no address. */
export function personHue(email: string, name = ""): number {
  const key = email.trim().toLowerCase() || name.trim().toLowerCase();
  return fnv1a(key) % HUES;
}

/** "Ada Lovelace" → "AL", "linus" → "L", "Jean-Luc Picard" → "JP"; "?" without letters. */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => /\p{L}|\p{N}/u.exec(word)?.[0])
    .filter((letter) => letter !== undefined);
  const first = words[0];
  if (first === undefined) return "?";
  const last = words.length > 1 ? words[words.length - 1] : "";
  return (first + (last ?? "")).toUpperCase();
}
