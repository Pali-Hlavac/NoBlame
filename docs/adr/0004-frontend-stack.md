# 0004: Frontend stack (React, TanStack Query, Zustand, shadcn/ui)

- Status: Accepted
- Date: 2026-10-27
- Milestone: M1

## Context and problem

The UI must stay responsive while showing large amounts of data, work well with the keyboard, be
accessible, and be easy to extend feature by feature. We need clear rules for where state lives:
data that comes from the backend, and state that exists only in the UI (open dialogs, active tab,
selected theme option in a menu).

## Decision drivers

- A mature component model and ecosystem; strict TypeScript support.
- One obvious place for backend data, with caching, refetching and error handling.
- Small, explicit UI state without boilerplate.
- Accessible primitives (focus management, ARIA) we own and can restyle.
- Fast builds and tests.

## Considered options

1. React 19 + TanStack Query + Zustand + shadcn/ui (Radix) + Tailwind 4 + Vite
2. Svelte 5 with stores
3. React with Redux Toolkit (RTK Query) and a component library such as MUI

## Decision outcome

Chosen option: **React 19 + TanStack Query + Zustand + shadcn/ui + Tailwind 4 + Vite**. This is
also the stack of the sibling project RipeMongo, so proven components and patterns are reused.

- **Backend data → TanStack Query**, in each feature's `api/` folder (for example
  `src/features/git-env/api/gitInfo.ts`). Queries call commands through `unwrap(...)`.
  Defaults in `src/app/query-client.ts`: no retries (the backend is local and failures are
  deterministic), no refetch on focus, and failed mutations show a toast with the error hint.
- **UI-only state → Zustand**, in each feature's `store/` folder (open tabs in
  `src/features/workspace/store/tabs.ts`, the palette's open state, the About dialog).
- **Never copy query data into Zustand.** A store may hold ids or paths that point at query
  data, not the data itself. Graph rows will live outside React state in typed arrays (M2).
- **Components**: shadcn/ui primitives on Radix in `src/shared/ui/` (button, dialog, dropdown
  menu, tooltip, command, kbd). They are copied source, not a dependency, so we can change them.
- **Command palette**: `cmdk` (`src/features/command-palette/`). Each item's search value is its
  visible label; using the command id made fuzzy matches outrank the right command.
- **Styling**: Tailwind 4 utilities and design tokens in `src/app/styles.css` (light and dark),
  merged with `cn()`. No inline colors. Every interactive element has a visible focus ring.
- **Build and tests**: Vite 8, Vitest with jsdom and Testing Library.

### Consequences

Good:

- Clear split: backend data has one cache, UI state has small stores.
- Radix gives keyboard and screen-reader behaviour for dialogs, menus and tooltips.
- Shared components and patterns from RipeMongo shorten M1.

Bad:

- Two state libraries to learn instead of one.
- React re-renders need care in hot paths; the commit graph is drawn on a canvas outside React
  (ADR 0009) for this reason.
- TypeScript is pinned to 6.0 until `typescript-eslint` supports TypeScript 7.

## Pros and cons of the options

### Svelte 5

- Good: less runtime overhead, concise components.
- Bad: smaller ecosystem for accessible primitives and virtualization; no reuse from RipeMongo.

### Redux Toolkit with RTK Query and MUI

- Good: one state library for everything.
- Bad: more boilerplate; MUI's styling model is harder to keep consistent with our tokens.

## Links

- [ADR 0005](0005-code-organization.md)
- [../development/standards.md](../development/standards.md)
