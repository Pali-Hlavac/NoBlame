/**
 * `blob:` URLs for file contents. Each buffer gets one URL, made on first use during render, and
 * the URL is revoked after the buffer is garbage-collected (query data is dropped 30 s after a
 * preview leaves the screen). No effect is involved, so StrictMode's double effects cannot
 * revoke a URL that is still shown.
 */
const urls = new WeakMap<ArrayBuffer, string>();
const revoker = new FinalizationRegistry<string>((url) => {
  URL.revokeObjectURL(url);
});

/** The URL of `data` as a file of MIME type `type`. */
export function objectUrlFor(data: ArrayBuffer, type: string): string {
  const known = urls.get(data);
  if (known) return known;
  const url = URL.createObjectURL(new Blob([data], { type }));
  urls.set(data, url);
  revoker.register(data, url);
  return url;
}
