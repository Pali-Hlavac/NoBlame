// `pnpm test:a11y`: runs the frontend tests with an axe-core audit of what each one renders
// (`src/test/setup.ts`) and prints the problems found, grouped by rule. Colour contrast is
// checked separately (`src/app/contrast.test.ts`).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const report = join(mkdtempSync(join(tmpdir(), "noblame-a11y-")), "report.txt");
const run = spawnSync("pnpm", ["exec", "vitest", "run", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, A11Y_AUDIT: report },
});
const found = existsSync(report) ? readFileSync(report, "utf8") : "";
const byRule = new Map();
for (const line of found.split("\n")) {
  const rule = /^ {2}([\w-]+): /.exec(line)?.[1];
  if (rule) byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
}
if (byRule.size === 0) {
  console.log("\nNo accessibility problems found.");
} else {
  console.log(`\nAccessibility problems (details: ${report}):`);
  for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule}: ${String(count)}`);
  }
}
process.exit(run.status === 0 && byRule.size === 0 ? 0 : 1);
