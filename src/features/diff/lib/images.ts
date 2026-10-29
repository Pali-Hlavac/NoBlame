/** Which files the diff tab previews as images. */

/** Formats the webview can show, by file extension. SVG is text and gets a text diff. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
};

/** The MIME type of an image file at `path`, or `undefined` for other files. */
export function imageType(path: string): string | undefined {
  const dot = path.lastIndexOf(".");
  if (dot < 0 || dot < path.lastIndexOf("/")) return undefined;
  return IMAGE_TYPES[path.slice(dot + 1).toLowerCase()];
}
