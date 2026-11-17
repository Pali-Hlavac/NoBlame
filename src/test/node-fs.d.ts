/**
 * The one Node API tests use to read source files (`src/app/contrast.test.ts` reads
 * `styles.css`); the app's TypeScript has no Node types, on purpose.
 */
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
