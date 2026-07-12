# dotUI v2 Package Readability & Repo Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `@dotui/*` package readable and documented (compiler first), remove duplication, and bring the whole repo to a lint-clean, working-scripts baseline — with zero behavior change.

**Architecture:** 9 independent commits, one per package plus a final repo pass. Each commit is gated by that package's `build` + `test` + `typecheck` and never changes public API behavior (the 60 existing tests are the safety net; a few new tests cover new seams). Spec: `docs/superpowers/specs/2026-07-06-package-cleanup-design.md`.

**Tech Stack:** TypeScript 5.7, tsup, vitest, Babel (`@babel/parser`/`@babel/types`), React 19, Next.js 15, Drizzle + libSQL, Biome 1.9.

## Global Constraints

- **This machine has NO bare `pnpm` on PATH.** Every pnpm command MUST be invoked as `corepack pnpm …`. All commands below assume cwd = repo root `C:\Users\rvish\Downloads\dotUI\dotui-v2` unless stated.
- **Behavior-preserving:** after every task, that package's existing tests still pass unmodified (exception: none — no existing test file is edited in this plan).
- **Every commit message ends with:** `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- **No new features.** Delete-visual UI, version timeline, palette guardrail are OUT of scope.
- Biome style applies: single quotes, semicolons, 2-space indent, line width 100.
- Run each package gate as: `corepack pnpm --filter "@dotui/<name>" run build`, `… run test`, `… run typecheck`.

---

### Task 1: `@dotui/compiler` — explicit AST walk, testable CLI, README

**Files:**
- Modify: `packages/compiler/src/walk.ts` (rewrite `findRootDots`, add worked-example doc)
- Modify: `packages/compiler/src/extract.ts` (intent-revealing names)
- Modify: `packages/compiler/src/cli.ts` (remove import-time execution, fix string concat)
- Create: `packages/compiler/src/bin.ts` (the executable entry)
- Modify: `packages/compiler/tsup.config.ts` (entry `src/cli.ts` → `src/bin.ts`)
- Modify: `packages/compiler/package.json` (drop unused `@babel/traverse` + `@types/babel__traverse`)
- Modify: `package.json` (root — `dotui` and `schema:demo` scripts: `dist/cli.cjs` → `dist/bin.cjs`)
- Modify: `apps/demo/package.json`, `apps/gmail/package.json`, `apps/youtube/package.json` (`schema` script path)
- Modify: `apps/demo/scripts/ensure-schema.mjs`, `apps/gmail/scripts/ensure-schema.mjs`, `apps/youtube/scripts/ensure-schema.mjs` (line 9: `const CLI = '../../packages/compiler/dist/cli.cjs';` → `…/dist/bin.cjs`)
- Create: `packages/compiler/tests/cli.test.ts`
- Create: `packages/compiler/README.md`

**Interfaces:**
- Consumes: nothing from other tasks (first task).
- Produces: `run(argv: string[]): number` exported from `src/cli.ts` (already exported today; now side-effect-free on import). `findRootDots(nodes: t.Node[]): t.JSXElement[]` and `assignDotIds(roots, scope)` keep their exact current signatures — `extract.ts`, `plugin.ts`, and existing tests depend on them.

- [ ] **Step 1: Write the failing CLI test**

Create `packages/compiler/tests/cli.test.ts`:

```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../src/cli';

const PANEL_SOURCE = `
export function Home() {
  return (
    <dot.panel className="flex flex-col">
      <dot.text>Hello</dot.text>
    </dot.panel>
  );
}
`;

describe('run', () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dotui-cli-'));
    previousCwd = process.cwd();
    process.chdir(dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('builds a schema file from a panel source', () => {
    writeFileSync(join(dir, 'home.panel.tsx'), PANEL_SOURCE);
    const code = run(['build', '**/*.panel.tsx', '--out', 'out/schema.json']);
    expect(code).toBe(0);
    const schema = JSON.parse(readFileSync(join(dir, 'out', 'schema.json'), 'utf8'));
    expect(schema.panels['home/panel#0']).toBeDefined();
    expect(schema.dots['home/panel#0/text#0']).toBeDefined();
  });

  it('rejects a missing subcommand with exit code 1', () => {
    expect(run([])).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails for the right reason**

Run: `corepack pnpm --filter "@dotui/compiler" run test`
Expected: the new `cli.test.ts` FAILS (importing `../src/cli` executes `run(process.argv.slice(2))` at module load, which under vitest's argv prints the usage error; the first test then may also misbehave). The 12 existing tests still pass. If the import side effect happens to be benign and both tests pass already, that's acceptable — proceed (the refactor below removes the side effect regardless).

- [ ] **Step 3: Split the CLI — remove import-time execution, fix the concat**

In `packages/compiler/src/cli.ts`, delete the last line:

```ts
run(process.argv.slice(2));
```

and replace the conflicts error block (currently string `+` concatenation, the repo's one real `lint/style/useTemplate` hit) with:

```ts
  if (conflicts.length > 0) {
    const list = conflicts.map((c) => `  ✗ ${c}`).join('\n');
    console.error(
      `Schema id conflicts (every dot/panel id must be unique):\n${list}\nCause: two source files share a base name, so they produce the same id scope. Rename one.`,
    );
    return 1;
  }
```

Create `packages/compiler/src/bin.ts`:

```ts
#!/usr/bin/env node
/** Executable entry for `dotui`. All logic lives in cli.ts so it can be unit-tested. */

import { run } from './cli';

process.exitCode = run(process.argv.slice(2));
```

Note: this also fixes a latent defect — previously the return code of `run()` was discarded, so failed builds exited 0.

In `packages/compiler/tsup.config.ts` change the entry line:

```ts
  entry: ['src/index.ts', 'src/bin.ts'],
```

- [ ] **Step 4: Update every `dist/cli.cjs` reference to `dist/bin.cjs`**

Eight sites (all currently say `cli.cjs`):
- `package.json` root, scripts `dotui` and `schema:demo`
- `apps/demo/package.json`, `apps/gmail/package.json`, `apps/youtube/package.json` — each `schema` script
- `apps/demo/scripts/ensure-schema.mjs`, `apps/gmail/scripts/ensure-schema.mjs`, `apps/youtube/scripts/ensure-schema.mjs` — each line 9 `const CLI = …`

Verify none remain: `grep -rn "cli.cjs" package.json apps packages --include="*.json" --include="*.mjs" | grep -v node_modules` → no output.

- [ ] **Step 5: Rewrite `walk.ts` with an explicit, documented traversal**

Replace the entire contents of `packages/compiler/src/walk.ts` with:

```ts
/**
 * The single source of truth for id assignment. Both `dotui build` (schema
 * extraction) and the Babel plugin (runtime stamping) call `assignDotIds`, so an
 * element's id is identical at build time and at render time — the guarantee that
 * lets a generated overlay map back onto the right live element.
 *
 * Worked example — this source file:
 *
 *   // profile.panel.tsx
 *   export function Profile() {
 *     return (
 *       <dot.panel className="flex">
 *         <dot.text>Ada</dot.text>
 *         <dot.text>Lovelace</dot.text>
 *         <dot.panel>
 *           <dot.badge>Online</dot.badge>
 *         </dot.panel>
 *       </dot.panel>
 *     );
 *   }
 *
 * produces these ids (scope "profile" comes from the file name; `#n` is the
 * element's index among same-kind siblings within its parent panel):
 *
 *   profile/panel#0                    ← the root panel
 *   profile/panel#0/text#0             ← "Ada"
 *   profile/panel#0/text#1             ← "Lovelace"
 *   profile/panel#0/panel#0            ← the nested panel
 *   profile/panel#0/panel#0/badge#0    ← "Online"
 *
 * Ids are structural (position in the source), not name-based, so the developer
 * never has to invent or maintain them — but it also means panels must be authored
 * as static JSX, not produced by `.map()`, or every instance collapses onto one id.
 */

import * as t from '@babel/types';
import { isDotKind, PANEL_KIND } from '@dotui/core';
import { dotKindOf, isDotElement } from './ast';
import { makeId, makeSegment } from './ids';

/**
 * Find the top-level `dot.*` elements: dot elements with no dot ancestor.
 *
 * JSX can appear anywhere an expression can — a return statement, a ternary, an
 * array literal, a callback argument — so there is no fixed list of statement
 * shapes to check. Instead we walk every AST child (Babel's VISITOR_KEYS table
 * tells us, per node type, exactly which properties hold child nodes) and stop
 * descending at the first dot element we meet: everything beneath it belongs to
 * `assignDotIds`, not to this search.
 */
export function findRootDots(nodes: t.Node[]): t.JSXElement[] {
  const roots: t.JSXElement[] = [];
  const visit = (node: t.Node): void => {
    if (t.isJSXElement(node) && isDotElement(node)) {
      roots.push(node);
      return; // its subtree is walked by assignDotIds
    }
    for (const child of childrenOf(node)) visit(child);
  };
  for (const node of nodes) visit(node);
  return roots;
}

/** The AST child nodes of `node`, read via Babel's own per-type child-key table. */
function childrenOf(node: t.Node): t.Node[] {
  const children: t.Node[] = [];
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) if (isAstNode(item)) children.push(item);
    } else if (isAstNode(value)) {
      children.push(value);
    }
  }
  return children;
}

function isAstNode(value: unknown): value is t.Node {
  return typeof value === 'object' && value !== null && 'type' in value;
}

/**
 * Map every known dot element in these trees to its structural id.
 *
 * Three deliberate rules:
 * - Only panels recurse: a dot's children are content (text/expressions), never
 *   further addressable dots, so the walk goes deeper only through `dot.panel`.
 * - Sibling counters are per parent AND per kind — that is what makes the second
 *   `dot.text` inside a panel `text#1` while a following `dot.badge` is `badge#0`.
 * - Unknown kinds (e.g. a typo like `dot.txt`) get no id; extract.ts reports them
 *   as warnings instead of guessing.
 */
export function assignDotIds(roots: t.JSXElement[], scope: string): Map<t.JSXElement, string> {
  const ids = new Map<t.JSXElement, string>();

  const visit = (node: t.JSXElement, parents: string[], counters: Map<string, number>): void => {
    const kind = dotKindOf(node.openingElement);
    if (!kind || (kind !== PANEL_KIND && !isDotKind(kind))) return;

    const index = counters.get(kind) ?? 0;
    counters.set(kind, index + 1);
    const segment = makeSegment(kind, index);
    ids.set(node, makeId(scope, parents, segment));

    if (kind === PANEL_KIND) {
      const childCounters = new Map<string, number>();
      for (const child of node.children) {
        if (t.isJSXElement(child) && isDotElement(child)) {
          visit(child, [...parents, segment], childCounters);
        }
      }
    }
  };

  const rootCounters = new Map<string, number>();
  for (const root of roots) visit(root, [], rootCounters);
  return ids;
}
```

Behavioral note for the implementer: the old `findRootDots` reflected over `Object.keys` of every object and kept walking inside dot elements (where nothing could ever be collected). The new version visits the same JSX via `VISITOR_KEYS` and prunes at dot roots — same output set. The existing `plugin.test.ts` asserts extractor ids === stamped ids, which locks this in.

- [ ] **Step 6: Intent-revealing names in `extract.ts`**

In `packages/compiler/src/extract.ts`, rename (pure rename, all call sites in this one file):
- `buildNode` → `recordElement` — update the doc comment to: `/** Record one dot element into the schema under its assigned id; returns the id (or null for unknown kinds, which get a warning at the call site). */`
- `buildChildren` → `recordPanelChildren` — doc comment: `/** Record a panel's direct children, in order. Non-dot elements still render at runtime but are not addressable, so they only produce a warning. */`

- [ ] **Step 7: Drop the unused Babel deps and reinstall**

In `packages/compiler/package.json` remove the line `"@babel/traverse": "^7.26.4",` from `dependencies` and `"@types/babel__traverse": "^7.20.6",` from `devDependencies` (verified unused: no `traverse` import anywhere in src or tests).

Run: `$env:CI='true'; corepack pnpm install --no-frozen-lockfile --config.confirmModulesPurge=false`
Expected: lockfile updates, install succeeds.

- [ ] **Step 8: Write `packages/compiler/README.md`**

```markdown
# @dotui/compiler

Turns `*.panel.tsx` sources into (a) a committed schema file the LLM reads and
(b) runtime id stamps on the live elements — from **one shared walk**, so the two
can never disagree.

## Pipeline

```
*.panel.tsx ──parse──▶ findRootDots ──▶ assignDotIds ──┬─▶ extract.ts ─▶ mergeSchemas ─▶ .dotui/schema.json   (dotui build)
                                                       └─▶ plugin.ts  ─▶ __dotId="…" stamped into the JSX     (app build)
```

- `walk.ts` — the shared traversal. `findRootDots` finds top-level `dot.*`
  elements; `assignDotIds` gives every known dot a structural id
  (`<file-scope>/<panel-path>/<kind>#<sibling-index>`). See the worked example
  at the top of the file.
- `extract.ts` — reads each element's className / `type` / `required` /
  `description` / content into `PanelNode`/`DotNode` records (`@dotui/core` types).
- `merge.ts` — combines per-file schemas; **fails the build** on id collisions
  (two files with the same base name → same scope).
- `plugin.ts` — Babel plugin (`dotuiBabelPlugin`) for the app build; stamps the
  same ids as `__dotId` props.
- `ids.ts` — id string construction + file-scope derivation.
- `ast.ts` — small readers over Babel JSX nodes (className, string/bool props,
  content parts). No traversal logic.
- `cli.ts` / `bin.ts` — `dotui build <glob…> [--out <path>]`; `run()` is pure
  logic (unit-tested), `bin.ts` is the 3-line executable.

## Usage

```sh
node packages/compiler/dist/bin.cjs build "apps/demo/app/**/*.panel.tsx" --out apps/demo/.dotui/schema.json
```

## The contract that matters

The schema's ids and the stamped runtime ids come from the same `assignDotIds`
call. If you change the walk, both sides move together — but any previously
persisted overlay keyed by old ids will no longer match.

Gotcha: ids are source-position-based, so author panels as static JSX. A shared
card component or a `.map()` collapses every instance onto a single id.
```

- [ ] **Step 9: Package gate**

Run: `corepack pnpm --filter "@dotui/compiler" run build`, then `… run test`, then `… run typecheck`
Expected: build emits `dist/bin.cjs` (+ index bundles); **14 tests pass** (12 existing + 2 new CLI); typecheck clean.

Then prove the renamed bin works end to end:
Run: `corepack pnpm --filter "@dotui/demo" run schema`
Expected: prints `Wrote .dotui/schema.json — 4 panels, N dots.` (numbers per current demo sources; exit 0).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(compiler): explicit VISITOR_KEYS walk, testable CLI (bin.ts entry), README

- findRootDots no longer reflects over every object key; it walks Babel's
  VISITOR_KEYS child table and prunes at dot roots (same output, readable)
- cli.ts is pure logic (2 new tests); bin.ts is the executable and now
  propagates run()'s exit code (failed builds exited 0 before)
- all cli.cjs references updated to bin.cjs; unused @babel/traverse dropped

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `@dotui/core` — shared overlay merge + README

**Files:**
- Create: `packages/core/src/merge.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/merge.test.ts`
- Create: `packages/core/README.md`

**Interfaces:**
- Consumes: `Overlay`, `StyleOverride` from `./types/overlay` (existing).
- Produces: `mergeOverride(prev: StyleOverride, patch: StyleOverride): StyleOverride` and `mergeOverlay(base: Overlay, patch: Overlay): Overlay`, exported from `@dotui/core`. Tasks 4 and 5 depend on these exact names.

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeOverlay, mergeOverride } from '../src/merge';

describe('mergeOverride', () => {
  it('accumulates classes and lets the patch win on hidden and style', () => {
    const merged = mergeOverride(
      { className: 'p-2', hidden: true, style: { color: 'red', margin: 1 } },
      { className: 'bg-red-500', hidden: false, style: { color: 'blue' } },
    );
    expect(merged.className).toBe('p-2 bg-red-500');
    expect(merged.hidden).toBe(false);
    expect(merged.style).toEqual({ color: 'blue', margin: 1 });
  });

  it('keeps prev.hidden when the patch does not mention it', () => {
    expect(mergeOverride({ hidden: true }, { className: 'p-2' }).hidden).toBe(true);
  });

  it('leaves style undefined when neither side has one', () => {
    expect(mergeOverride({ className: 'a' }, { className: 'b' }).style).toBeUndefined();
  });
});

describe('mergeOverlay', () => {
  it('merges per id and keeps untouched ids', () => {
    const next = mergeOverlay(
      { a: { className: 'p-2' }, b: { hidden: true } },
      { a: { className: 'bg-red-500' } },
    );
    expect(next.a?.className).toBe('p-2 bg-red-500');
    expect(next.b?.hidden).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter "@dotui/core" run test`
Expected: FAIL — `Cannot find module '../src/merge'` (or equivalent). Existing 3 schema tests pass.

- [ ] **Step 3: Implement `packages/core/src/merge.ts`**

```ts
/**
 * The one place "layer a patch onto an override" is defined. Semantics:
 * classes ACCUMULATE (the runtime's tailwind-merge resolves conflicts, so the
 * later class wins on screen); `style` keys and `hidden` from the patch take
 * precedence. Successive prompts therefore stack rather than replace.
 */

import type { Overlay, StyleOverride } from './types/overlay';

export function mergeOverride(prev: StyleOverride, patch: StyleOverride): StyleOverride {
  return {
    ...prev,
    ...patch,
    className: [prev.className, patch.className].filter(Boolean).join(' ') || undefined,
    style: prev.style || patch.style ? { ...prev.style, ...patch.style } : undefined,
    hidden: patch.hidden ?? prev.hidden,
  };
}

/** Apply `mergeOverride` per dot id; ids missing from the patch pass through. */
export function mergeOverlay(base: Overlay, patch: Overlay): Overlay {
  const next: Overlay = { ...base };
  for (const [id, override] of Object.entries(patch)) {
    next[id] = mergeOverride(next[id] ?? {}, override);
  }
  return next;
}
```

Add to `packages/core/src/index.ts` (after the overlay type export line):

```ts
export { mergeOverlay, mergeOverride } from './merge';
```

- [ ] **Step 4: Run tests to verify pass**

Run: `corepack pnpm --filter "@dotui/core" run test`
Expected: PASS — 7 tests (3 existing + 4 new).

- [ ] **Step 5: Write `packages/core/README.md`**

```markdown
# @dotui/core

The shared vocabulary of dotUI. Types and constants only — no React, no IO —
so every other package (server or client) can depend on it.

## What lives here

- **Schema types** (`types/schema.ts`): `SchemaFile` — the artifact `dotui build`
  writes and the LLM reads. `PanelNode` (container, ordered `children` ids),
  `DotNode` (leaf: element tag, authored classes, `required`, `description`,
  `content`), `ContentPart` (static text vs opaque `{expr}` slot), `Palette`.
- **Overlay types** (`types/overlay.ts`): `Overlay = Record<dotId, StyleOverride>`
  — the LLM's entire output. `StyleOverride = { className?, style?, hidden? }`.
- **Merge** (`merge.ts`): `mergeOverride` / `mergeOverlay` — the single
  definition of how a patch layers onto the current overlay (classes accumulate;
  `hidden`/`style` from the patch win).
- **Kinds** (`kinds.ts`): the closed `dot.*` vocabulary and its kind → HTML
  element mapping. Adding an authorable element starts here.
- **Guardrail vocabulary** (`guardrail.ts`): `ALLOWED_FAMILIES` — the Tailwind
  utility families a generator may emit (enforced in `@dotui/guardrail`).
- **Zod schemas** (`schema.ts`): runtime validation for `SchemaFile`
  (`schemaFileSchema`), used by the compiler CLI before writing the artifact.

## Example

```ts
import { mergeOverlay, type Overlay } from '@dotui/core';

const current: Overlay = { 'home/panel#0': { className: 'p-4' } };
const patch: Overlay = { 'home/panel#0': { className: 'bg-slate-900', hidden: false } };
mergeOverlay(current, patch);
// { 'home/panel#0': { className: 'p-4 bg-slate-900', hidden: false, style: undefined } }
```
```

- [ ] **Step 6: Package gate**

Run: `corepack pnpm --filter "@dotui/core" run build`, `… run test`, `… run typecheck`
Expected: all green, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat(core): shared mergeOverride/mergeOverlay + README

One definition of patch-layering semantics, to be consumed by @dotui/prompt
and @dotui/llm instead of their two hand-rolled copies.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `@dotui/elements` — one factory instead of six components + README

**Files:**
- Modify: `packages/elements/src/dot.tsx` (full rewrite below)
- Create: `packages/elements/README.md`

**Interfaces:**
- Consumes: `useOverlay` from `./overlay` (existing, unchanged).
- Produces: the `dot` object with the **exact same public prop types** as today: `dot.panel: (props: DotProps<'div'>)`, `dot.text: (props: DotProps<'p'> & { type?: TextTag })`, `dot.button`, `dot.badge`, `dot.input`, `dot.image`. No consumer changes anywhere.

- [ ] **Step 1: Run the existing tests as the baseline**

Run: `corepack pnpm --filter "@dotui/elements" run test`
Expected: 13 tests pass. These tests (overlay merge, prop/event forwarding, metadata stripping, hidden) are the spec for the factory — they must pass unchanged afterward.

- [ ] **Step 2: Rewrite `packages/elements/src/dot.tsx`**

Replace the whole file with:

```tsx
/**
 * The `dot.*` namespace: thin React components that render real HTML and merge the
 * LLM's style overlay onto the developer's own className/style. What you write is
 * what renders; the overlay only augments it (override wins on conflicting classes).
 *
 * Every kind comes from the same factory. Only two things ever vary:
 * - void elements (input, img) render no children;
 * - for dot.text the `type` prop selects the rendered tag (h1, span, …) — for every
 *   other kind `type` is an ordinary DOM prop (e.g. <dot.input type="email">).
 */

import type { CSSProperties, ComponentPropsWithRef, ElementType, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { useOverlay } from './overlay';

/**
 * dotUI authoring metadata. `__dotId` is stamped by the build-time plugin;
 * `description`/`required` are read by `dotui build` for the LLM. None of these
 * are real DOM attributes, so the factory strips them before rendering.
 */
type DotMeta = { __dotId?: string; description?: string; required?: boolean };
// ComponentPropsWithRef so `ref` and every native event/attribute (onClick, onChange,
// onMouseEnter, disabled, aria-*, data-*, ...) flow straight through to the element.
type DotProps<T extends ElementType> = ComponentPropsWithRef<T> & DotMeta;

type TextTag =
  | 'p'
  | 'span'
  | 'label'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'strong'
  | 'em'
  | 'small';

/**
 * Read the dot's overlay: `hidden` (the dot renders nothing) plus the merged
 * author/override className & style (override wins on conflicts).
 */
function useMerged(dotId: string | undefined, className?: string, style?: CSSProperties) {
  const override = useOverlay(dotId);
  return {
    hidden: override?.hidden ?? false,
    className: twMerge(className, override?.className),
    style: { ...style, ...(override?.style as CSSProperties | undefined) },
  };
}

type FactoryOptions = {
  /** Void element (input, img): render no children. */
  isVoid?: boolean;
  /** dot.text only: `type` selects the rendered tag instead of reaching the DOM. */
  typeIsTag?: boolean;
};

type AnyDotProps = DotMeta & {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Record<string, unknown>;

/** Build one dot component: strip dotUI metadata, merge the overlay, render. */
function createDot(defaultElement: ElementType, options: FactoryOptions = {}) {
  function Dot(props: AnyDotProps) {
    const { __dotId, description, required, className, style, children, ...rest } = props;
    const { hidden, ...merged } = useMerged(__dotId, className, style);
    if (hidden) return null;

    let Tag = defaultElement;
    let domProps: Record<string, unknown> = rest;
    if (options.typeIsTag) {
      const { type, ...withoutType } = rest;
      if (typeof type === 'string') Tag = type as ElementType;
      domProps = withoutType;
    }

    if (options.isVoid) return <Tag {...domProps} {...merged} />;
    return (
      <Tag {...domProps} {...merged}>
        {children}
      </Tag>
    );
  }
  return Dot;
}

export const dot: {
  panel: (props: DotProps<'div'>) => ReactNode;
  text: (props: Omit<DotProps<'p'>, 'type'> & { type?: TextTag }) => ReactNode;
  button: (props: DotProps<'button'>) => ReactNode;
  badge: (props: DotProps<'span'>) => ReactNode;
  input: (props: DotProps<'input'>) => ReactNode;
  image: (props: DotProps<'img'>) => ReactNode;
} = {
  panel: createDot('div'),
  text: createDot('p', { typeIsTag: true }),
  button: createDot('button'),
  badge: createDot('span'),
  input: createDot('input', { isVoid: true }),
  image: createDot('img', { isVoid: true }),
};
```

If the `export const dot: {…} = {…}` assignment produces a variance error under `strictFunctionTypes` (props of `createDot`'s component vs. the annotated signatures), assign each entry with a targeted cast instead — e.g. `panel: createDot('div') as (props: DotProps<'div'>) => ReactNode` — and keep the object annotation. Do NOT loosen the public annotation itself.

- [ ] **Step 3: Run the elements tests**

Run: `corepack pnpm --filter "@dotui/elements" run test`
Expected: all 13 PASS unchanged. If any fail, the factory diverged from the six originals — fix the factory, not the tests. (Watch for: `type` leaking to the DOM on text, `type` NOT reaching the DOM on input, `required`/`description`/`__dotId` leaking, children rendered on void elements.)

- [ ] **Step 4: Package gate + downstream typecheck**

Run: `corepack pnpm --filter "@dotui/elements" run build`, `… run typecheck`
Then confirm the biggest consumer still typechecks against the new types:
Run: `corepack pnpm --filter "@dotui/gmail" run typecheck`
Expected: clean. (Gmail authors all six kinds incl. `<dot.input type="search">` and `<dot.text type="h2">`.)

- [ ] **Step 5: Write `packages/elements/README.md`**

```markdown
# @dotui/elements

The runtime half of dotUI: the `dot.*` components and the overlay context.

## How a dot renders

1. The build-time Babel plugin (`@dotui/compiler`) stamped `__dotId` on the element.
2. The component looks its id up in the overlay from `<DotOverlayProvider value={…}>`.
3. `hidden: true` → renders nothing (a hidden panel drops its whole subtree).
4. Otherwise it renders its real HTML element with
   `twMerge(authorClassName, overlayClassName)` (overlay wins on conflicts) and
   `{ ...authorStyle, ...overlayStyle }`.

Everything else — `onClick`, `ref`, `disabled`, `aria-*`, `data-*`, `hover:`
classes — flows through untouched. The dotUI-only props (`__dotId`,
`description`, `required`) are stripped and never reach the DOM.

## API

- `dot.panel` (div) · `dot.text` (p; `type` picks the tag: h1…small) ·
  `dot.button` · `dot.badge` (span) · `dot.input` · `dot.image` — all created by
  one internal factory; see `createDot` in `dot.tsx`.
- `DotOverlayProvider` / `useOverlay` — plain React context carrying the
  `Overlay` (`@dotui/core`).

## Example

```tsx
<DotOverlayProvider value={{ 'home/panel#0/text#0': { className: 'text-xl' } }}>
  <dot.panel __dotId="home/panel#0" className="p-4">
    <dot.text __dotId="home/panel#0/text#0" className="text-sm">Hello</dot.text>
  </dot.panel>
</DotOverlayProvider>
// the text renders class "text-xl" (overlay beats the authored text-sm)
```

(In an app you never write `__dotId` yourself — the compiler plugin stamps it.)
```

- [ ] **Step 6: Commit**

```bash
git add packages/elements
git commit -m "refactor(elements): collapse six dot components into one createDot factory + README

Public prop types unchanged; the 13 existing interaction/merge tests pass
untouched. Overlay-merge logic now exists once.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `@dotui/llm` — use the shared merge in the mock + README

**Files:**
- Modify: `packages/llm/src/mock.ts` (replace the hand-rolled `add` merge)
- Create: `packages/llm/README.md`

**Interfaces:**
- Consumes: `mergeOverride(prev, patch)` from `@dotui/core` (Task 2).
- Produces: no API change; `mockGenerator`, `openaiGenerator`, `generatePanelOverlay`, `panelSlice` signatures untouched.

- [ ] **Step 1: Baseline**

Run: `corepack pnpm --filter "@dotui/llm" run test`
Expected: 11 tests pass.

- [ ] **Step 2: Replace the duplicated merge in `mock.ts`**

In `packages/llm/src/mock.ts`, change the core import to include `mergeOverride`:

```ts
import { type DotNode, type Overlay, type PanelNode, type StyleOverride, mergeOverride } from '@dotui/core';
```

(and remove the now-redundant `import type { … } from '@dotui/core'` line it replaces), then replace the `add` closure:

```ts
  const add = (id: string, override: StyleOverride) => {
    overlay[id] = mergeOverride(overlay[id] ?? {}, override);
  };
```

Delete nothing else — the keyword rules all call `add` and are unchanged.

- [ ] **Step 3: Run tests**

Run: `corepack pnpm --filter "@dotui/llm" run test`
Expected: 11 PASS. (The tests assert with `toContain`/`toBe` on className and `hidden` — the shared merge produces the same classes in the same order.)

- [ ] **Step 4: Write `packages/llm/README.md`**

```markdown
# @dotui/llm

The generation pipeline: prompt + schema slice in → guardrailed overlay out.

## Flow

```
prompt, panelId
      │
panelSlice(schema, panelId)        the panel + nested panels + their dots
      │
Generator (seam)                   mockGenerator | openaiGenerator
      │
generatePanelOverlay               scope to the panel's ids → validateOverlay
      │
{ overlay, dropped }
```

- `slice.ts` — `panelSlice`: the editable subtree for one panel.
- `types.ts` — `GenerateRequest` (prompt, target slice, optional whole-UI
  read-only `context`, `current` overlay so the model edits the LIVE look) and
  the `Generator` seam.
- `mock.ts` — deterministic keyword generator (bigger/dark/contrast/colour/
  rounded/spacious, hide/show by matching dot text, declutter → hide
  non-`required`). The no-API-key fallback; same signature as the real one.
- `openai.ts` — OpenAI Responses API with a forced `emit_overlay` tool call,
  current-overlay folding (the model sees authored+overlay classes), and one
  retry on invalid or guardrail-dropped output.
- `generate.ts` — `generatePanelOverlay(req, generator)`: the single entry
  point apps call. Scopes output to the target panel (a generator can never
  patch ids outside its slice) and runs the guardrail.

## Example (server route)

```ts
const generator = process.env.OPENAI_API_KEY
  ? openaiGenerator({ apiKey: process.env.OPENAI_API_KEY })
  : mockGenerator;

const slice = panelSlice(schema, panelId);
const result = await generatePanelOverlay(
  { prompt, panelId, ...slice, palette: schema.palette, current },
  generator,
);
// result.overlay → apply; result.dropped → what the guardrail stripped
```
```

- [ ] **Step 5: Package gate**

Run: `corepack pnpm --filter "@dotui/llm" run build`, `… run test`, `… run typecheck`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add packages/llm
git commit -m "refactor(llm): mock generator uses @dotui/core mergeOverride + README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `@dotui/prompt` — slim provider via useSavedVisuals, merge re-export, README

**Files:**
- Modify: `packages/prompt/src/merge.ts` (becomes a re-export)
- Create: `packages/prompt/src/use-saved-visuals.ts`
- Modify: `packages/prompt/src/provider.tsx`
- Create: `packages/prompt/README.md`

**Interfaces:**
- Consumes: `mergeOverlay` from `@dotui/core` (Task 2).
- Produces: no public API change — `DotuiPromptProvider`, `Promptable`, `usePrompt`, `mergeOverlay` (re-export), and all types keep their exact current signatures. Internal: `useSavedVisuals({ initial, onSaveVisual, onApplied, overlay, setOverlay })` returning `{ visuals, activeVisualId, saveVisual, selectVisual, clearActiveVisual }`.

- [ ] **Step 1: Baseline**

Run: `corepack pnpm --filter "@dotui/prompt" run test`
Expected: 5 tests pass.

- [ ] **Step 2: Make `merge.ts` a re-export**

Replace the whole contents of `packages/prompt/src/merge.ts` with:

```ts
/**
 * Patch-layering semantics live in @dotui/core (one definition for the whole
 * system); re-exported here because this package's consumers and tests reach it
 * as part of the prompt API.
 */

export { mergeOverlay } from '@dotui/core';
```

- [ ] **Step 3: Create `packages/prompt/src/use-saved-visuals.ts`**

```ts
'use client';

import type { Overlay } from '@dotui/core';
import { useCallback, useState } from 'react';
import type { DotuiPromptProviderProps, SavedVisual } from './types';

type Args = {
  initial: SavedVisual[];
  onSaveVisual: DotuiPromptProviderProps['onSaveVisual'];
  onApplied: DotuiPromptProviderProps['onApplied'];
  overlay: Overlay;
  setOverlay: (overlay: Overlay) => void;
};

/**
 * The "saved visuals" concern, out of the provider's way: named whole-UI
 * snapshots of the overlay. Saving snapshots the current overlay (persisted via
 * `onSaveVisual` when the host returns a stored record, in-memory otherwise);
 * selecting one replaces the live overlay wholesale — a snapshot is absolute,
 * not a patch — and reports it via `onApplied` so the host can persist the
 * new live look. `activeVisualId` is which snapshot the live overlay currently
 * matches; the provider clears it when a prompt diverges the look.
 */
export function useSavedVisuals({ initial, onSaveVisual, onApplied, overlay, setOverlay }: Args) {
  const [visuals, setVisuals] = useState<SavedVisual[]>(initial);
  const [activeVisualId, setActiveVisualId] = useState<string | number | null>(null);

  const saveVisual = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const snapshot = overlay;
      const saved = await onSaveVisual?.({ name: trimmed, overlay: snapshot });
      const entry: SavedVisual = saved ?? { id: Date.now(), name: trimmed, overlay: snapshot };
      setVisuals((prev) => [entry, ...prev.filter((v) => v.id !== entry.id)]);
      setActiveVisualId(entry.id);
    },
    [overlay, onSaveVisual],
  );

  const selectVisual = useCallback(
    async (visual: SavedVisual) => {
      setOverlay(visual.overlay);
      setActiveVisualId(visual.id);
      await onApplied?.(visual.overlay);
    },
    [setOverlay, onApplied],
  );

  const clearActiveVisual = useCallback(() => setActiveVisualId(null), []);

  return { visuals, activeVisualId, saveVisual, selectVisual, clearActiveVisual };
}
```

- [ ] **Step 4: Slim `packages/prompt/src/provider.tsx`**

Replace the whole file with:

```tsx
'use client';

import type { Overlay } from '@dotui/core';
import { mergeOverlay } from '@dotui/core';
import { DotOverlayProvider } from '@dotui/elements';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PromptContext } from './context';
import { Control } from './control';
import { PROMPT_STYLES } from './styles';
import type { DotuiPromptProviderProps } from './types';
import { useSavedVisuals } from './use-saved-visuals';

/**
 * Wraps an app in the prompt layer: holds the live overlay, renders a
 * DotOverlayProvider so every dot picks it up, and shows the floating ✨ control.
 * End-users prompt a single panel (via `<Promptable>`) or all panels (global box);
 * each prompt is generated by the app-supplied `generate` and merged into the
 * overlay live. Saved visuals (named whole-UI snapshots) live in useSavedVisuals.
 */
export function DotuiPromptProvider({
  generate,
  initialOverlay = {},
  onApplied,
  savedVisuals = [],
  onSaveVisual,
  children,
}: DotuiPromptProviderProps) {
  const [overlay, setOverlay] = useState<Overlay>(initialOverlay);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  // Panels register themselves (top-down, in render order) so a global prompt
  // knows what to iterate.
  const registered = useRef<Set<string>>(new Set());

  const { visuals, activeVisualId, saveVisual, selectVisual, clearActiveVisual } = useSavedVisuals(
    { initial: savedVisuals, onSaveVisual, onApplied, overlay, setOverlay },
  );

  const runPanel = useCallback(
    async (panelId: string, prompt: string) => {
      if (!prompt.trim()) return;
      setBusy(true);
      setActivePanelId(panelId);
      try {
        const { overlay: patch } = await generate({ prompt, panelId, current: overlay });
        const next = mergeOverlay(overlay, patch);
        setOverlay(next);
        clearActiveVisual(); // the look no longer matches any saved snapshot
        await onApplied?.(next);
      } finally {
        setBusy(false);
        setActivePanelId(null);
      }
    },
    [generate, overlay, onApplied, clearActiveVisual],
  );

  const runGlobal = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      setBusy(true);
      try {
        // One panel at a time, in registration (top-down) order. Each call gets the
        // overlay accumulated so far as `current`, so a later panel can match the
        // styling already chosen for earlier ones. We apply after every panel so the
        // screen repaints panel-by-panel, highlighting the one being worked on.
        let acc = overlay;
        for (const id of registered.current) {
          setActivePanelId(id);
          const { overlay: patch } = await generate({ prompt, panelId: id, current: acc });
          acc = mergeOverlay(acc, patch);
          setOverlay(acc);
        }
        clearActiveVisual();
        await onApplied?.(acc);
      } finally {
        setBusy(false);
        setActivePanelId(null);
      }
    },
    [generate, overlay, onApplied, clearActiveVisual],
  );

  const register = useCallback((id: string) => {
    registered.current.add(id);
  }, []);
  const unregister = useCallback((id: string) => {
    registered.current.delete(id);
  }, []);

  const ctx = useMemo(
    () => ({ editMode, busy, activePanelId, runPanel, register, unregister }),
    [editMode, busy, activePanelId, runPanel, register, unregister],
  );

  return (
    <PromptContext.Provider value={ctx}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static stylesheet */}
      <style dangerouslySetInnerHTML={{ __html: PROMPT_STYLES }} />
      <DotOverlayProvider value={overlay}>{children}</DotOverlayProvider>
      <Control
        editMode={editMode}
        busy={busy}
        onToggle={() => setEditMode((v) => !v)}
        onGlobal={runGlobal}
        visuals={visuals}
        activeVisualId={activeVisualId}
        onSaveVisual={saveVisual}
        onSelectVisual={selectVisual}
      />
    </PromptContext.Provider>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `corepack pnpm --filter "@dotui/prompt" run test`
Expected: 5 PASS unchanged (they exercise global runs, per-panel runs, current-threading, onApplied — all through the public UI).

- [ ] **Step 6: Write `packages/prompt/README.md`**

```markdown
# @dotui/prompt

The end-user "edit by prompt" layer. Client components only; how overlays are
generated stays behind the app-supplied `generate` function.

## Pieces

- `DotuiPromptProvider` — owns the live overlay, renders the
  `DotOverlayProvider` all dots read, injects the (namespaced, safelist-free)
  active-panel CSS, and shows the floating "✨ Edit UI" control.
  - `generate({ prompt, panelId, current })` — REQUIRED; the bridge to the
    pipeline (typically a POST to a server route that runs `@dotui/llm`).
  - `initialOverlay` — seed (e.g. a persona base or the persisted look).
  - `onApplied(overlay)` — fires after a run with the full live overlay;
    supply to persist. Apply-only otherwise (no DB writes here — apply ≠ save).
  - `savedVisuals` / `onSaveVisual` — seed + persistence for named whole-UI
    snapshots (see `use-saved-visuals.ts`). Selecting a visual REPLACES the
    live overlay; prompts then stack on top of it.
- `Promptable panelId` — wraps one panel: inline ✨ prompt box in edit mode,
  registers the panel for global runs, shows the animated highlight while the
  generator works on it. `showControl={false}` registers without the button
  (background/root panels).
- Global runs go panel-by-panel top-down, threading the accumulated overlay as
  `current` so later panels match earlier styling; the screen repaints as it goes.
- `mergeOverlay` — re-export of `@dotui/core`'s (successive prompts stack).

## Example

```tsx
<DotuiPromptProvider
  generate={(args) => fetch('/api/generate', { method: 'POST', body: JSON.stringify(args) }).then(r => r.json())}
  initialOverlay={persisted}
  onApplied={(o) => fetch('/api/overlay', { method: 'POST', body: JSON.stringify({ panelId: 'app', overlay: o }) })}
>
  <Promptable panelId="home/panel#0"><Home /></Promptable>
</DotuiPromptProvider>
```
```

- [ ] **Step 7: Package gate**

Run: `corepack pnpm --filter "@dotui/prompt" run build`, `… run test`, `… run typecheck`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add packages/prompt
git commit -m "refactor(prompt): extract useSavedVisuals hook, merge re-exported from core + README

Provider now reads as overlay-state + generate-runs; saved-visuals state and
persistence live in their own hook. Public API unchanged; 5 tests untouched.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `@dotui/guardrail` — README

**Files:**
- Create: `packages/guardrail/README.md`

**Interfaces:** no code change; documents `classifyClass`, `validateClassName`, `validateOverlay`.

- [ ] **Step 1: Write `packages/guardrail/README.md`**

```markdown
# @dotui/guardrail

Keeps generated styling inside the rails: every class an LLM emits is checked
against the allowed Tailwind families (`ALLOWED_FAMILIES` in `@dotui/core`);
anything else is stripped — never trusted, never rendered.

## API

- `classifyClass(token)` → the utility's family (`'text-size'`, `'bg-color'`,
  `'padding'`, …) or `null` if outside the vocabulary. Variant prefixes
  (`hover:`, `md:`, `dark:`) and a leading `-` are stripped first, so
  `hover:bg-red-500` classifies as `bg-color`.
- `validateClassName(className)` → `{ className, dropped }` — keeps allowed
  tokens, reports the rest.
- `validateOverlay(overlay)` → `{ overlay, dropped }` — the same per dot id.
  `hidden` and `style` pass through untouched (visibility is always allowed;
  inline style is not class-validated).

## Example

```ts
validateClassName('text-xl shadow-2xl bg-slate-900');
// { className: 'text-xl bg-slate-900', dropped: ['shadow-2xl'] }
```

`@dotui/llm` runs `validateOverlay` twice: inside `openaiGenerator` (to give the
model retry feedback) and in `generatePanelOverlay` (the enforcement pass every
generator goes through, mock included).
```

- [ ] **Step 2: Package gate + commit**

Run: `corepack pnpm --filter "@dotui/guardrail" run test`
Expected: 4 tests pass.

```bash
git add packages/guardrail
git commit -m "docs(guardrail): README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `@dotui/store` — ready() as a plain method + README

**Files:**
- Modify: `packages/store/src/store.ts` (constructor cleanup only)
- Create: `packages/store/README.md`

**Interfaces:**
- Consumes: `createDb`, `ensureSchema` from `./client` (existing).
- Produces: no API change (`createOverlayStore(url): OverlayStore` untouched).

- [ ] **Step 1: Baseline**

Run: `corepack pnpm --filter "@dotui/store" run test`
Expected: 9 tests pass.

- [ ] **Step 2: Replace the constructor-assigned closure with a private method**

In `packages/store/src/store.ts`, change the top of `LibsqlOverlayStore` from the current closure-in-constructor form to:

```ts
class LibsqlOverlayStore implements OverlayStore {
  private readonly db: Db;
  private readonly client: Client;
  private ensured?: Promise<void>;

  constructor(url: string) {
    const { db, client } = createDb(url);
    this.db = db;
    this.client = client;
  }

  /** Bootstrap the tables once, on first use; concurrent callers share the promise. */
  private ready(): Promise<void> {
    this.ensured ??= ensureSchema(this.client);
    return this.ensured;
  }
```

and add the type import at the top of the file:

```ts
import type { Client } from '@libsql/client';
```

Delete the old `private ready: () => Promise<void>;` declaration and the `this.ready = () => {…}` assignment. Every `await this.ready();` call site stays exactly as is.

- [ ] **Step 3: Run tests**

Run: `corepack pnpm --filter "@dotui/store" run test`
Expected: 9 PASS.

- [ ] **Step 4: Write `packages/store/README.md`**

```markdown
# @dotui/store

Server-side persistence on Drizzle + libSQL. One factory —
`createOverlayStore(url)` — returns the `OverlayStore` interface (the seam; a
Postgres implementation would swap in behind it). `file:./x.db` locally,
`libsql://…` (Turso) in prod via `DOTUI_DB_URL`; tables bootstrap themselves on
first use (raw DDL, no drizzle-kit).

## Three tables, three jobs

| table | what it is | key methods |
|---|---|---|
| `overlays` | versioned history of the live look, per `(scope, panelId)`; `is_current` marks the live row | `save`, `current`, `history`, `setCurrent` (rollback), `list` |
| `visuals` | named whole-UI snapshots the user deliberately saves and switches between | `saveVisual`, `listVisuals`, `deleteVisual` |
| `schemas` | content-hash-deduped snapshots of the committed build schema — a history LOG, never the live read source (the file `.dotui/schema.json` stays authoritative) | `saveSchema` (idempotent), `currentSchema`, `listSchemas` |

Every `save` inserts a new version row and repoints `is_current` in one
transaction — nothing is overwritten, so history and rollback are always intact.

## Example

```ts
const store = createOverlayStore(process.env.DOTUI_DB_URL ?? 'file:.dotui/dotui.db');
await store.save({ panelId: 'app', overlay, appSchemaVersion: 1, prompt: 'dark mode' });
const live = await store.current();       // merged is_current rows for the scope
await store.setCurrent('app', 3);         // roll back to version 3
```

Note: libSQL is a native module — Next.js apps must list `@libsql/client` +
`libsql` in `serverExternalPackages`.
```

- [ ] **Step 5: Package gate + commit**

Run: `corepack pnpm --filter "@dotui/store" run build`, `… run test`, `… run typecheck`
Expected: all green.

```bash
git add packages/store
git commit -m "refactor(store): ready() as a plain private method + README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `@dotui/devtools` — README

**Files:**
- Create: `packages/devtools/README.md`

**Interfaces:** no code change; documents `DotuiDevtools`.

- [ ] **Step 1: Write `packages/devtools/README.md`**

```markdown
# @dotui/devtools

A drop-in inspector so developers can SEE what dotUI is doing: the schema the
build produced and the overlays the DB is holding.

## Usage

```tsx
import { DotuiDevtools } from '@dotui/devtools';
import { schema } from '../lib/schema';

<DotuiDevtools schema={schema} />                 // polls /api/overlay for DB rows
<DotuiDevtools schema={schema} endpoint={null} /> // schema-only mode (no server)
<DotuiDevtools schema={schema} endpoint="/api/x" pollMs={5000} />
```

- **Schema tab** — the committed build artifact: palette, panels, dots, content
  slots, `required`/`description` metadata.
- **Overlays (DB) tab** — the `overlays` table: per-version rows expandable to
  every column plus the stored overlay JSON.

Deliberately decoupled from `@dotui/store`: it consumes the wire JSON via its
own `OverlayRecordView` type, so no libSQL ends up in the client bundle — the
endpoint is the seam.

Consumer wiring (Next.js): add `@dotui/devtools` to `transpilePackages` and
`packages/devtools/src/**` to the Tailwind `content` globs.
```

- [ ] **Step 2: Package gate + commit**

Run: `corepack pnpm --filter "@dotui/devtools" run test`
Expected: 3 tests pass.

```bash
git add packages/devtools
git commit -m "docs(devtools): README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Repo pass — lint clean, working root scripts, ARCHITECTURE.md, final gate

**Files:**
- Modify: `biome.json` (ignore `.claude`)
- Modify: many files via `biome check --fix` (formatting/import order only)
- Modify: `package.json` (root scripts run via corepack)
- Create: `ARCHITECTURE.md`

**Interfaces:** none — repo hygiene.

- [ ] **Step 1: Ignore tool state in biome**

In `biome.json`, extend the ignore list:

```json
    "ignore": ["dist", "node_modules", ".next", "**/.dotui/**", ".claude"]
```

- [ ] **Step 2: Auto-fix the formatting/import-order debt**

Run: `corepack pnpm exec biome check --fix .`
Then: `corepack pnpm exec biome check .`
Expected: second command exits 0 ("Checked N files … no errors"). If any diagnostic survives, it is NOT auto-fixable — fix it by hand in the reported file (the only known hand-fix, `useTemplate` in the old cli.ts, was already eliminated in Task 1). Do not add suppression comments without a reason string.

- [ ] **Step 3: Make root scripts work on this machine**

In root `package.json`, update scripts to invoke pnpm through corepack (bare `pnpm` is not on PATH here):

```json
  "scripts": {
    "build": "corepack pnpm -r --filter \"./packages/*\" run build",
    "test": "corepack pnpm -r --filter \"./packages/*\" run test",
    "typecheck": "corepack pnpm -r run typecheck",
    "lint": "biome check .",
    "lint:fix": "biome check --fix .",
    "dotui": "node packages/compiler/dist/bin.cjs",
    "schema:demo": "node packages/compiler/dist/bin.cjs build \"apps/demo/app/**/*.panel.tsx\" --out apps/demo/.dotui/schema.json"
  },
```

(`dotui`/`schema:demo` already say `bin.cjs` after Task 1 — keep them; `lint:fix` is new.)

- [ ] **Step 4: Write `ARCHITECTURE.md`** (repo root)

```markdown
# dotUI v2 — how one panel flows through the system

dotUI is JSX-first generative UI: the developer authors ordinary React +
Tailwind with `dot.*` components; an LLM restyles it via a guardrailed overlay,
never touching structure. This walks ONE file end to end. Each step links the
package that owns it (each has its own README).

## 0. Author — `apps/demo/app/profile.panel.tsx`

```tsx
export function Profile() {
  return (
    <dot.panel className="flex gap-4 p-6" description="Profile header">
      <dot.image className="h-12 w-12 rounded-full" src={avatarUrl} required />
      <dot.text type="h2" className="text-lg font-semibold" required>{name}</dot.text>
      <dot.badge className="bg-green-100">Online</dot.badge>
    </dot.panel>
  );
}
```

`dot.*` ([`@dotui/elements`](packages/elements/README.md)) render exactly what
is written. `required`/`description` are metadata for the LLM, stripped before
the DOM. `{name}` is an opaque dynamic slot — the system never reads user data.

## 1. Build — `dotui build` → `.dotui/schema.json`

[`@dotui/compiler`](packages/compiler/README.md) parses the file and assigns
every element a structural id — `profile/panel#0`, `profile/panel#0/image#0`,
`profile/panel#0/text#0`, `profile/panel#0/badge#0` — then writes the schema:
each panel/dot with its element tag, authored classes, metadata, and content,
plus a palette seeded from the author's own classes
([`@dotui/core`](packages/core/README.md) owns all these types). The schema is
a COMMITTED artifact — it ships in lockstep with the JSX it describes.

## 2. App build — the same ids, stamped

The Babel plugin (`dotuiBabelPlugin`, wired in each app's `babel.config.js`)
runs the SAME id walk and stamps `__dotId="profile/panel#0"` etc. onto the live
elements. Build-time schema and runtime DOM can never disagree — one walk, two
outputs.

## 3. Prompt — "make it calmer and hide the badge"

[`@dotui/prompt`](packages/prompt/README.md)'s floating ✨ control (or a
panel's inline one) POSTs `{ prompt, panelId, current }` to the app's
`/api/generate` route. Server-side ([`@dotui/llm`](packages/llm/README.md)):

1. `panelSlice(schema, 'profile/panel#0')` → the editable subtree;
2. a `Generator` runs — `openaiGenerator` when `OPENAI_API_KEY` is set (a
   forced `emit_overlay` tool call that sees the CURRENT look and the rest of
   the UI as read-only context), `mockGenerator` otherwise;
3. `generatePanelOverlay` scopes the output to the slice's ids and runs the
   [`@dotui/guardrail`](packages/guardrail/README.md): every class must belong
   to an allowed Tailwind family or it is dropped and reported.

The result is an overlay — nothing but per-id patches:

```json
{
  "profile/panel#0": { "className": "gap-6 p-8 bg-slate-50" },
  "profile/panel#0/badge#0": { "hidden": true }
}
```

## 4. Render — overlay meets JSX

The provider merges the patch into its live overlay (`mergeOverlay`,
[`@dotui/core`](packages/core/README.md): classes accumulate, so successive
prompts stack) and every `dot.*` re-renders: `twMerge(authored, overlay)` —
override wins on conflict — and the badge returns `null`. Panels can be
authored as a SUPERSET and revealed per audience with `hidden:false` (that is
the whole persona demo in `apps/youtube` / `apps/gmail`).

## 5. Persist (optional) — [`@dotui/store`](packages/store/README.md)

Apps that persist call `onApplied` → POST the overlay; the store inserts a new
VERSION row and repoints `is_current` (full history, rollback via
`setCurrent`). Named "saved visuals" snapshots and content-hashed schema
snapshots live alongside. The DB is never authoritative over the schema file.

[`@dotui/devtools`](packages/devtools/README.md) renders all of this — the
schema and the DB rows — as a drop-in inspector.

## Invariants worth knowing

- **One id walk.** Extraction and stamping share `assignDotIds`; changing it
  invalidates persisted overlays.
- **Author panels as static JSX** — ids are source-position-based; `.map()`
  collapses every card onto one id.
- **The LLM only ever patches className/style/hidden** on ids that exist; the
  guardrail + panel scoping enforce it even against a misbehaving model.
- **Tailwind safelist**: generated classes are not in source, so each app
  safelists the guardrail families in its Tailwind config.
- **This machine**: only `corepack pnpm` is on PATH.
```

- [ ] **Step 5: Final verification gate**

Run, in order (all from repo root):
1. `corepack pnpm run build` → every package builds (this also proves the new root scripts work).
2. `corepack pnpm run test` → expected total: **66 tests** (core 7, guardrail 4, compiler 14, elements 13, devtools 3, store 9, llm 11, prompt 5), all passing.
3. `corepack pnpm run lint` → exit 0.
4. `corepack pnpm run typecheck` → clean.
5. `corepack pnpm --filter "@dotui/gmail" run build` → `next build` compiles (proves the refactored packages + updated bin path work for the heaviest consumer).

- [ ] **Step 6: Update PROGRESS.md**

Add at the end of the `## Status` section (before "⬜ Remaining / follow-ups"):

```markdown
### ✅ Readability & repo cleanup (2026-07-06, verified)
- Every package refactored for readability where a first read stumbled and given a
  README; root `ARCHITECTURE.md` walks one panel through the whole pipeline.
- `@dotui/compiler`: `findRootDots` rewritten over Babel's VISITOR_KEYS (explicit,
  documented, worked id example); CLI split into testable `run()` + `bin.ts` entry
  (now propagates exit codes — failed builds exited 0 before); `dist/cli.cjs` →
  `dist/bin.cjs` everywhere; unused `@babel/traverse` dropped.
- `@dotui/elements`: six copy-pasted components → one `createDot` factory (public
  prop types unchanged). `@dotui/core` now owns the single `mergeOverride`/
  `mergeOverlay` (consumed by prompt + llm mock). `@dotui/prompt`: saved-visuals
  state extracted to `useSavedVisuals`. `@dotui/store`: `ready()` a plain method.
- Repo: biome lint clean end to end (formatting/import-order debt paid, `.claude`
  ignored); root scripts now run via `corepack pnpm` so they work on this machine;
  `lint:fix` script added.
- **Verified:** 66 tests pass (core 7, compiler 14, elements 13, guardrail 4,
  llm 11, prompt 5, store 9, devtools 3); full workspace build + typecheck clean;
  `next build` of gmail compiles; `biome check .` exits 0.
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(repo): lint clean end-to-end, corepack-safe root scripts, ARCHITECTURE.md

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review notes (already applied)

- **Spec coverage:** compiler deep-clean (Task 1), elements factory (Task 3), shared merge (Tasks 2/4/5), prompt slim (Task 5), light-touch + READMEs for core/guardrail/store/devtools (Tasks 2/6/7/8), repo pass with lint/scripts/ARCHITECTURE.md (Task 9). All spec items have tasks; commit count matches the spec's plan of 9.
- **Type consistency:** `mergeOverride(prev, patch)` defined in Task 2 is what Task 4's mock and Task 5's re-export consume; `useSavedVisuals` args/return in Task 5 match the provider that uses them; `run(argv): number` matches both `bin.ts` and `cli.test.ts`.
- **Known risk callouts for implementers:** (1) Task 3's `dot` object annotation may need per-entry casts under `strictFunctionTypes` — instructions included; (2) Task 1 changes `findRootDots` internals — `plugin.test.ts` (extractor ids ≡ stamped ids) is the invariant test; (3) core's merge leaves `style` undefined instead of `{}` when neither side has one — render-identical, and no existing test asserts the empty object.
