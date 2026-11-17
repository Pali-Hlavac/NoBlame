// Vitest setup file added by `pnpm test:a11y` (scripts/a11y-audit.mjs): runs axe on what every
// test left on screen, before it is cleaned up (Testing Library's own cleanup is off then), and
// appends the problems to the file named by `A11Y_AUDIT`. The tests pass or fail as usual.
/* global document -- runs in the tests' jsdom window */
import { appendFileSync } from "node:fs";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { accessibilityProblems } from "../src/test/axe";

const auditFile = process.env.A11Y_AUDIT ?? "";

afterEach(async (context) => {
  if (document.body.childElementCount > 0) {
    const problems = await accessibilityProblems();
    if (problems.length > 0) {
      const where = `${context.task.file.name} > ${context.task.name}`;
      appendFileSync(auditFile, problems.map((problem) => `${where}\n  ${problem}\n`).join(""));
    }
  }
  cleanup();
});
