# dotUI v2 — Package readability & repo cleanup design

**Date:** 2026-07-06
**Goal:** Make the packages (especially `@dotui/compiler`) readable, understandable,
and maintainable, then bring the whole repo to a clean baseline. No behavior changes,
no new features.

## Motivation

The owner cannot follow parts of the code — the compiler in particular. The codebase
is structurally small (largest file 219 lines) and fully green (60 tests), so this is
a comprehension problem, not a size problem. The fix is targeted refactoring where
code is genuinely hard to read, plus documentation that gives each package a map.

## Ground rules

- **Behavior-preserving.** All 60 existing tests pass after every step; build and
  typecheck stay green. Existing tests are the safety net; they are not rewritten.
- **One commit per package** (8) plus one repo-level commit, so each step is
  independently reviewable and revertible.
- **Out of scope:** the known feature follow-ups (delete-visual UI, per-panel version
  timeline, palette guardrail pass), dependency upgrades, and app redesigns.

## Work items

### 1. `@dotui/compiler` (the centerpiece)

- **`walk.ts` — rewrite `findRootDots`** as an explicit, documented traversal over the
  node shapes that matter (module statements → JSX trees → element children), replacing
  the reflection loop that crawls every property of every AST node. Include a worked
  example in a comment block: a small panel source and the exact id assigned to each
  element (`profile/panel#0`, `profile/panel#0/text#0`, …).
- **Rename for intent** where names are opaque (`buildNode` → `recordDot`, clearer
  `Ctx` field names) and add "why" comments at the three key decisions: ids are
  structural, only panels recurse, unknown kinds are skipped with a warning.
- **Split `cli.ts`** into `cli.ts` (exported, testable `run()`) and `bin.ts` (the
  entry that calls it). Today the CLI executes at import time and is untestable.
  The `dist/cli.cjs` bin path referenced by root scripts is updated to match.
- **`README.md`**: pipeline diagram (author → extract → merge → schema.json; plugin
  stamps the same ids at build), one real input→output example, and the id-scheme
  contract in plain words.

### 2. `@dotui/elements` — factory for `dot.*`

Collapse the six near-identical components (Panel/Text/Button/Badge/Input/Image) into
one `createDot(defaultElement, options)` factory (~140 → ~60 lines). Options cover the
two variations: void elements (input, image — no children) and tag-from-`type`
(text). The overlay-merge logic (`useMerged`) then exists in exactly one place.
Public API (`dot`, `DotOverlayProvider`, `useOverlay`) is unchanged. README added.

### 3. One overlay-merge implementation (`core`, `prompt`, `llm`)

`prompt/src/merge.ts` (`mergeOverlay`) and the `add()` closure in `llm/src/mock.ts`
both implement "classes accumulate; hidden/style from the patch win". Move a single
`mergeOverlay`/`mergeOverride` into `@dotui/core` (React-free, next to the `Overlay`
type). `prompt` re-exports it for compatibility; `mock.ts` uses it. READMEs added.

### 4. `@dotui/prompt` — slim the provider

Extract the saved-visuals concern (visuals list, active visual id, save/select
callbacks — 4 of the provider's 6 state pieces) into a `useSavedVisuals` hook in its
own file. `provider.tsx` then reads as "live overlay + generate runs" at a glance.
Public API unchanged. README added.

### 5. Light-touch packages: `core`, `guardrail`, `store`, `devtools`

Naming/comment polish only where a first read stumbles — e.g. `store.ts`'s
constructor assigning the `this.ready` closure mid-constructor becomes a plain
private method. No structural changes. README each: purpose, public API, one example.

### 6. Repo-level pass

- **Lint clean end-to-end:** `biome check --fix` clears the ~28 formatting and
  import-order diagnostics; hand-fix the two real rule hits (`useTemplate` in
  `compiler/src/cli.ts`, `noDangerouslySetInnerHtml` at its reported site). After
  this, `lint` is a meaningful signal.
- **Root scripts work on this machine:** scripts currently shell out to bare `pnpm`,
  which is not on PATH (corepack-only machine). Change them to run via corepack so
  `build`/`test`/`typecheck` from the root succeed.
- **Root `ARCHITECTURE.md`:** walks one real panel file through
  author → `dotui build` → schema → prompt → generator → guardrail → overlay →
  render, linking each step to its package and README.

## Verification

- Per package: that package's `build` + `test` + `typecheck` green before its commit.
- Final gate: full workspace build, all tests, `biome check` clean, and `next build`
  of `apps/gmail` (the heaviest consumer) compiles against the refactored packages.

## Commit plan

1. `compiler` refactor + README
2. `core` merge helper + polish + README
3. `elements` factory + README
4. `llm` dedup + README
5. `prompt` slim provider + re-export + README
6. `guardrail` polish + README
7. `store` polish + README
8. `devtools` polish + README
9. Repo pass: lint fix-all, root scripts, ARCHITECTURE.md
