# Repeated & Conditional Dots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dots inside `.map()` callbacks and conditionals addressable as repeated templates — one schema entry, `~` ids, overlay styles all instances — with build warnings (never silence) for unsupported shapes.

**Architecture:** All new logic lives in the shared walk (`@dotui/compiler/src/walk.ts`), so extraction and runtime stamping move together by construction. `@dotui/core` gains an additive `repeated?: true` schema flag; `@dotui/llm` gains one instruction line; `@dotui/elements` is untouched. Proof: the YouTube feed converts from 6 copy-pasted cards to a real `.map()`. Spec: `docs/superpowers/specs/2026-07-06-repeated-dots-design.md`.

**Tech Stack:** TypeScript 5.7, Babel (`@babel/parser`/`@babel/types`), vitest, Zod, Next.js 15.

## Global Constraints

- **NO bare `pnpm` on PATH** — every pnpm command MUST be `corepack pnpm …`. Repo root `C:\Users\rvish\Downloads\dotUI\dotui-v2`, branch `feat/repeated-dots`.
- **Existing static ids must stay byte-identical.** Expression-nested dots use a separate `~` counter namespace; `#` counters never see them. The id-stability test in Task 2 locks this in.
- **Template-only granularity:** an overlay patch on a repeated id styles ALL instances. No `dotKey`, no per-instance targeting, no shared-component work (all out of scope).
- **Descend exactly these shapes** inside a panel's expression children: arrow/function-expression bodies (block bodies: `return` arguments) — crossing one marks `repeated`; ternary consequent+alternate; logical (`&&`/`||`/`??`) right side; call-expression arguments that are inline functions; JSX fragments; nested expression containers. A dot reachable only through anything else → build warning, no id.
- Existing tests keep passing (66 today). Expected totals when done: core 9, compiler 20, elements 13, guardrail 4, devtools 3, store 9, llm 12, prompt 5 = **75**.
- Biome style: single quotes, semicolons, 2-space indent, line width 100 (`corepack pnpm exec biome check <paths>` before each commit; keep import lines under 100 chars by splitting value/type imports).
- Every commit message ends with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Package gates: `corepack pnpm --filter "@dotui/<name>" run build`, `… run test`, `… run typecheck`.

---

### Task 1: `@dotui/core` — additive `repeated` flag

**Files:**
- Modify: `packages/core/src/types/schema.ts` (add field to `DotNode` and `PanelNode`)
- Modify: `packages/core/src/schema.ts` (Zod)
- Test: `packages/core/tests/repeated.test.ts` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `DotNode.repeated?: true` and `PanelNode.repeated?: true` (optional, presence-only — `false` is invalid); `dotNodeSchema`/`panelNodeSchema` accept it. Task 2's extractor sets it; Task 3's prompt text references it.

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/repeated.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dotNodeSchema, panelNodeSchema } from '../src/schema';

describe('repeated flag', () => {
  it('accepts repeated: true on dots and panels', () => {
    const dot = dotNodeSchema.safeParse({
      id: 'a/panel#0/text~0',
      kind: 'text',
      element: 'p',
      className: '',
      dynamicClassName: false,
      required: false,
      content: [],
      repeated: true,
    });
    expect(dot.success).toBe(true);

    const panel = panelNodeSchema.safeParse({
      id: 'a/panel~0',
      kind: 'panel',
      element: 'div',
      className: '',
      dynamicClassName: false,
      children: [],
      repeated: true,
    });
    expect(panel.success).toBe(true);
  });

  it('rejects repeated: false — the flag is presence-only', () => {
    const panel = panelNodeSchema.safeParse({
      id: 'a/panel~0',
      kind: 'panel',
      element: 'div',
      className: '',
      dynamicClassName: false,
      children: [],
      repeated: false,
    });
    expect(panel.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm --filter "@dotui/core" run test`
Expected: the two new tests FAIL (`.strict()` schemas reject the unknown `repeated` key). The 7 existing core tests pass.

- [ ] **Step 3: Implement**

In `packages/core/src/types/schema.ts`, add to `DotNode` (after `description?: string;`):

```ts
  /** Present when this element renders N times from one source position (a `.map()`
   *  callback); a style override on its id applies to every instance. */
  repeated?: true;
```

and the same two-line doc + field to `PanelNode` (after its `description?: string;`).

In `packages/core/src/schema.ts`, add to `dotNodeSchema`'s object (after `description: z.string().optional(),`):

```ts
    repeated: z.literal(true).optional(),
```

and the same line to `panelNodeSchema` (after its `description` line).

- [ ] **Step 4: Run tests to verify pass**

Run: `corepack pnpm --filter "@dotui/core" run test`
Expected: PASS — 9 tests.

- [ ] **Step 5: Package gate + commit**

Run: `corepack pnpm --filter "@dotui/core" run build`, `… run test`, `… run typecheck`, and `corepack pnpm exec biome check packages/core`
Expected: all green.

```bash
git add packages/core
git commit -m "feat(core): additive repeated flag on schema nodes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `@dotui/compiler` — expression descent in the shared walk

**Files:**
- Modify: `packages/compiler/src/ids.ts` (marker parameter)
- Modify: `packages/compiler/src/walk.ts` (new return shape + descent; full replacement below)
- Modify: `packages/compiler/src/extract.ts` (consume assignment; record expression children; warnings)
- Modify: `packages/compiler/src/plugin.ts` (consume `.ids`)
- Test: `packages/compiler/tests/repeated.test.ts` (new)

**Interfaces:**
- Consumes: Task 1's `repeated?: true` on `DotNode`/`PanelNode` (`@dotui/core` must be rebuilt first — run the Task 1 gate's build before this task if not already done).
- Produces: `assignDotIds(roots: t.JSXElement[], scope: string): DotIdAssignment` where
  `type DotIdAssignment = { ids: Map<t.JSXElement, string>; repeated: Set<t.JSXElement>; unsupported: t.JSXElement[] }`
  (exported from walk.ts and from the package index alongside the existing exports). `makeSegment(kind, index, marker?: '#' | '~')`. Schema output: template ids like `feed/panel#0/panel~0`, `repeated: true` on function-boundary nodes, warnings for unsupported shapes.

- [ ] **Step 1: Write the failing tests**

Create `packages/compiler/tests/repeated.test.ts`:

```ts
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';
import { extractFile } from '../src/extract';
import { dotuiBabelPlugin } from '../src/plugin';

const MAP_SRC = `
export function Feed() {
  return (
    <dot.panel className="grid">
      <dot.text>Header</dot.text>
      {items.map((item) => (
        <dot.panel key={item.id} className="card">
          <dot.text>{item.title}</dot.text>
          <dot.badge>{item.meta}</dot.badge>
        </dot.panel>
      ))}
      <dot.button>Load more</dot.button>
    </dot.panel>
  );
}
`;

// Identical to MAP_SRC with the map expression removed — for the id-stability test.
const STATIC_SRC = `
export function Feed() {
  return (
    <dot.panel className="grid">
      <dot.text>Header</dot.text>
      <dot.button>Load more</dot.button>
    </dot.panel>
  );
}
`;

const COND_SRC = `
export function Status() {
  return (
    <dot.panel>
      {ready ? <dot.badge>Ready</dot.badge> : <dot.text>Waiting</dot.text>}
      {show && <dot.badge>Hint</dot.badge>}
    </dot.panel>
  );
}
`;

const NESTED_SRC = `
export function Grid() {
  return (
    <dot.panel>
      {rows.map((row) => (
        <dot.panel key={row.id}>
          {row.cells.map((cell) => (
            <dot.badge key={cell}>{cell}</dot.badge>
          ))}
        </dot.panel>
      ))}
    </dot.panel>
  );
}
`;

const UNSUPPORTED_SRC = `
export function Odd() {
  return <dot.panel>{(() => <dot.badge>x</dot.badge>)()}</dot.panel>;
}
`;

describe('repeated templates (.map)', () => {
  it('assigns ~ ids to mapped dots, marks them repeated, and lists them as children', () => {
    const { schema, warnings } = extractFile('feed.panel.tsx', MAP_SRC);
    expect(warnings).toEqual([]);

    const card = schema.panels['feed/panel#0/panel~0'];
    expect(card).toBeDefined();
    expect(card?.repeated).toBe(true);
    expect(card?.children).toEqual([
      'feed/panel#0/panel~0/text#0',
      'feed/panel#0/panel~0/badge#0',
    ]);
    expect(schema.dots['feed/panel#0/panel~0/text#0']?.repeated).toBe(true);
    expect(schema.panels['feed/panel#0']?.children).toEqual([
      'feed/panel#0/text#0',
      'feed/panel#0/panel~0',
      'feed/panel#0/button#0',
    ]);
  });

  it('leaves static ids byte-identical when an expression sibling is added', () => {
    const withMap = extractFile('feed.panel.tsx', MAP_SRC).schema;
    const withoutMap = extractFile('feed.panel.tsx', STATIC_SRC).schema;
    const staticIds = (ids: Record<string, unknown>) =>
      Object.keys(ids).filter((id) => !id.includes('~'));
    expect(staticIds(withMap.panels)).toEqual(Object.keys(withoutMap.panels));
    expect(staticIds(withMap.dots)).toEqual(Object.keys(withoutMap.dots));
  });
});

describe('conditional dots', () => {
  it('assigns ~ ids to ternary branches and && right side, NOT marked repeated', () => {
    const { schema, warnings } = extractFile('status.panel.tsx', COND_SRC);
    expect(warnings).toEqual([]);
    expect(schema.dots['status/panel#0/badge~0']?.repeated).toBeUndefined();
    expect(schema.dots['status/panel#0/text~0']).toBeDefined();
    expect(schema.dots['status/panel#0/badge~1']).toBeDefined();
    expect(schema.panels['status/panel#0']?.children).toEqual([
      'status/panel#0/badge~0',
      'status/panel#0/text~0',
      'status/panel#0/badge~1',
    ]);
  });
});

describe('nested maps', () => {
  it('composes ~ namespaces per parent', () => {
    const { schema } = extractFile('grid.panel.tsx', NESTED_SRC);
    expect(schema.panels['grid/panel#0/panel~0']?.repeated).toBe(true);
    expect(schema.dots['grid/panel#0/panel~0/badge~0']?.repeated).toBe(true);
  });
});

describe('unsupported expression shapes', () => {
  it('warns (never silently skips) and assigns no id', () => {
    const { schema, warnings } = extractFile('odd.panel.tsx', UNSUPPORTED_SRC);
    expect(Object.keys(schema.dots)).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('dot.badge');
    expect(warnings[0]).toContain('not addressable');
  });
});

describe('plugin parity for templates', () => {
  function applyPlugin(code: string, filename: string): t.File {
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    dotuiBabelPlugin().visitor.Program({ node: ast.program }, { file: { opts: { filename } } });
    return ast;
  }

  it('stamps exactly the extractor ids, including ~ template ids', () => {
    const ast = applyPlugin(MAP_SRC, 'feed.panel.tsx');
    const stamped: string[] = [];
    const visit = (node: t.Node): void => {
      if (t.isJSXAttribute(node) && t.isJSXIdentifier(node.name) && node.name.name === '__dotId') {
        if (t.isStringLiteral(node.value)) stamped.push(node.value.value);
      }
      for (const key of Object.keys(node)) {
        const value = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object' && 'type' in item) visit(item as t.Node);
          }
        } else if (value && typeof value === 'object' && 'type' in value) {
          visit(value as t.Node);
        }
      }
    };
    visit(ast.program);

    const { schema } = extractFile('feed.panel.tsx', MAP_SRC);
    const schemaIds = [...Object.keys(schema.panels), ...Object.keys(schema.dots)].sort();
    expect(stamped.sort()).toEqual(schemaIds);
    expect(schemaIds).toContain('feed/panel#0/panel~0');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `corepack pnpm --filter "@dotui/compiler" run test`
Expected: the 6 new tests FAIL (no `~` ids exist; `repeated` undefined; no warning emitted). The 14 existing compiler tests pass.

- [ ] **Step 3: Implement `ids.ts` marker**

In `packages/compiler/src/ids.ts`, replace `makeSegment` with:

```ts
/** `#` = static sibling index; `~` = expression-nested (template/conditional) index. */
export function makeSegment(kind: string, index: number, marker: '#' | '~' = '#'): string {
  return `${kind}${marker}${index}`;
}
```

- [ ] **Step 4: Implement the walk**

Replace `packages/compiler/src/walk.ts` in full with:

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
 *         {friends.map((f) => (
 *           <dot.panel key={f.id}>
 *             <dot.badge>{f.name}</dot.badge>
 *           </dot.panel>
 *         ))}
 *       </dot.panel>
 *     );
 *   }
 *
 * produces these ids (scope "profile" comes from the file name; `#n` is the index
 * among same-kind static siblings; `~n` marks an expression-nested element):
 *
 *   profile/panel#0                    ← the root panel
 *   profile/panel#0/text#0             ← "Ada"
 *   profile/panel#0/text#1             ← "Lovelace"
 *   profile/panel#0/panel~0            ← the friend-card TEMPLATE (repeated)
 *   profile/panel#0/panel~0/badge#0    ← the badge inside each card
 *
 * A template is ONE source element rendered N times: the plugin's single stamp
 * lands on every instance, and an overlay patch on its id styles all of them.
 * Static `#` counters never see expression-nested dots, so adding or removing a
 * `.map()` cannot shift any existing static id.
 */

import * as t from '@babel/types';
import { PANEL_KIND, isDotKind } from '@dotui/core';
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

export type DotIdAssignment = {
  /** Every known dot element mapped to its structural id. */
  ids: Map<t.JSXElement, string>;
  /** Elements beneath a function boundary — one source element, N rendered instances. */
  repeated: Set<t.JSXElement>;
  /** Dots inside expression shapes we do not descend; extract.ts warns about these. */
  unsupported: t.JSXElement[];
};

/**
 * Map every known dot element in these trees to its structural id.
 *
 * Rules:
 * - Only panels recurse; a non-panel dot's children are content.
 * - Static children count per parent AND per kind in the `#` namespace.
 * - Expression children (JSXExpressionContainer) are descended through a fixed
 *   set of shapes (see `descendExpression`); dots found there count in the
 *   separate `~` namespace, so static ids can never shift. Crossing a function
 *   boundary (a `.map()` callback) marks the dot — and its subtree — `repeated`.
 * - A dot reachable only through an unsupported shape gets NO id and is
 *   reported in `unsupported` so the build can warn instead of silently
 *   producing an unstyleable element.
 * - Unknown kinds (e.g. a typo like `dot.txt`) get no id; extract.ts warns.
 */
export function assignDotIds(roots: t.JSXElement[], scope: string): DotIdAssignment {
  const out: DotIdAssignment = { ids: new Map(), repeated: new Set(), unsupported: [] };

  const assign = (
    node: t.JSXElement,
    parents: string[],
    counters: Map<string, number>,
    marker: '#' | '~',
    repeated: boolean,
  ): void => {
    const kind = dotKindOf(node.openingElement);
    if (!kind || (kind !== PANEL_KIND && !isDotKind(kind))) return;

    const counterKey = kind + marker; // '#' and '~' count independently per parent
    const index = counters.get(counterKey) ?? 0;
    counters.set(counterKey, index + 1);
    const segment = makeSegment(kind, index, marker);
    out.ids.set(node, makeId(scope, parents, segment));
    if (repeated) out.repeated.add(node);

    if (kind !== PANEL_KIND) return;
    const childCounters = new Map<string, number>();
    for (const child of node.children) {
      if (t.isJSXElement(child) && isDotElement(child)) {
        assign(child, [...parents, segment], childCounters, '#', repeated);
      } else if (t.isJSXExpressionContainer(child)) {
        descendExpression(child, [...parents, segment], childCounters, repeated);
      }
    }
  };

  /**
   * Bounded descent through a panel's expression child. Supported shapes:
   * function bodies (crossing one ⇒ repeated), ternary branches, the right side
   * of `&&`/`||`/`??`, inline-function call arguments, JSX fragments, and nested
   * expression containers. Afterwards, any dot inside the expression that the
   * bounded descent did NOT reach is recorded as unsupported.
   */
  const descendExpression = (
    container: t.JSXExpressionContainer,
    parents: string[],
    counters: Map<string, number>,
    repeated: boolean,
  ): void => {
    const reached = new Set<t.JSXElement>();

    const descend = (node: t.Node, crossedFn: boolean): void => {
      if (t.isJSXElement(node)) {
        if (isDotElement(node)) {
          reached.add(node);
          assign(node, parents, counters, '~', repeated || crossedFn);
        }
        return; // non-dot JSX is not descended (same rule as static children)
      }
      if (t.isJSXFragment(node)) {
        for (const child of node.children) descend(child, crossedFn);
        return;
      }
      if (t.isJSXExpressionContainer(node)) {
        descend(node.expression, crossedFn);
        return;
      }
      if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
        if (t.isBlockStatement(node.body)) {
          for (const stmt of node.body.body) {
            if (t.isReturnStatement(stmt) && stmt.argument) descend(stmt.argument, true);
          }
        } else {
          descend(node.body, true);
        }
        return;
      }
      if (t.isConditionalExpression(node)) {
        descend(node.consequent, crossedFn);
        descend(node.alternate, crossedFn);
        return;
      }
      if (t.isLogicalExpression(node)) {
        descend(node.right, crossedFn);
        return;
      }
      if (t.isCallExpression(node)) {
        for (const arg of node.arguments) {
          if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
            descend(arg, crossedFn);
          }
        }
        return;
      }
      // Any other shape: not descended; the completeness check below reports its dots.
    };

    descend(container.expression, false);

    for (const dotEl of findRootDots([container])) {
      if (!reached.has(dotEl)) out.unsupported.push(dotEl);
    }
  };

  const rootCounters = new Map<string, number>();
  for (const root of roots) assign(root, [], rootCounters, '#', false);
  return out;
}
```

- [ ] **Step 5: Update the consumers**

`packages/compiler/src/plugin.ts` — in the `Program` visitor, replace the stamping loop:

```ts
        const { ids } = assignDotIds(roots, scope);
        for (const [node, id] of ids) stampId(node, id);
```

`packages/compiler/src/extract.ts`:

1. Add `findRootDots` and the type to the walk import:
   `import { type DotIdAssignment, assignDotIds, findRootDots } from './walk';`
2. In the `Ctx` type, replace `ids: Map<t.JSXElement, string>;` with `assignment: DotIdAssignment;`.
3. In `extractFile`, replace `ids: assignDotIds(roots, scope),` with `assignment: assignDotIds(roots, scope),` and, immediately after the `for (const root of roots) recordElement(root, ctx);` loop, add:

```ts
  for (const el of ctx.assignment.unsupported) {
    ctx.warnings.push(
      `<${elementName(el)}> is inside an unsupported expression and is not addressable — it renders, but overlays cannot target it. Supported: .map()/callback bodies, ternaries, &&/||/??. Author it statically to style it.`,
    );
  }
```

4. In `recordElement`, replace `const id = ctx.ids.get(node);` with `const id = ctx.assignment.ids.get(node);`, and add the repeated spread to BOTH records — the panel record:

```ts
    ctx.panels[id] = {
      id,
      kind: 'panel',
      element: DEFAULT_ELEMENT.panel,
      className: cls.value,
      dynamicClassName: cls.dynamic,
      ...(description ? { description } : {}),
      ...(ctx.assignment.repeated.has(node) ? { repeated: true as const } : {}),
      children: recordPanelChildren(node.children, ctx),
    };
```

and the dot record (same `...(ctx.assignment.repeated.has(node) ? { repeated: true as const } : {})` line, placed after the description spread).

5. Replace `recordPanelChildren` in full:

```ts
function recordPanelChildren(children: t.Node[], ctx: Ctx): string[] {
  const ids: string[] = [];
  for (const child of children) {
    if (t.isJSXElement(child)) {
      if (!isDotElement(child)) {
        ctx.warnings.push(`<${elementName(child)}> inside a panel renders but is not addressable.`);
        continue;
      }
      const id = recordElement(child, ctx);
      if (id) ids.push(id);
      else ctx.warnings.push(`Unknown dot kind "${elementName(child)}" ignored.`);
    } else if (t.isJSXExpressionContainer(child)) {
      // Dots the walk reached inside this expression (templates/conditionals), in
      // source order. Unreached dots are already queued as unsupported warnings.
      for (const el of findRootDots([child])) {
        if (!ctx.assignment.ids.has(el)) continue;
        const id = recordElement(el, ctx);
        if (id) ids.push(id);
      }
    }
  }
  return ids;
}
```

6. Export the new type from `packages/compiler/src/index.ts` — change the walk export line to:

```ts
export { type DotIdAssignment, assignDotIds, findRootDots } from './walk';
```

- [ ] **Step 6: Run the compiler tests**

Run: `corepack pnpm --filter "@dotui/compiler" run test`
Expected: **20 tests pass** (14 existing — untouched — plus 6 new). If the existing `plugin.test.ts`/`extract.test.ts`/`merge.test.ts`/`cli.test.ts` fail, the walk changed static behavior — fix the walk, never the tests.

- [ ] **Step 7: Package gate + downstream sanity**

Run: `corepack pnpm --filter "@dotui/compiler" run build`, `… run typecheck`, `corepack pnpm exec biome check packages/compiler`
Then regenerate the two apps with no expressions in their sources and confirm byte-identical schemas:

```bash
corepack pnpm --filter "@dotui/demo" run schema
corepack pnpm --filter "@dotui/gmail" run schema
git diff --stat apps/demo/.dotui/schema.json apps/gmail/.dotui/schema.json
```

Expected: `git diff` reports no changes.

- [ ] **Step 8: Commit**

```bash
git add packages/compiler
git commit -m "feat(compiler): expression descent — repeated templates (~ ids) and conditional dots

Dots inside .map() callbacks, ternaries, and logical expressions now get ids
in a separate ~ namespace (static ids provably unchanged), are marked
repeated across function boundaries, and unsupported shapes produce build
warnings instead of silent invisibility.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `@dotui/llm` — teach the model about templates

**Files:**
- Modify: `packages/llm/src/openai.ts` (one instruction line)
- Test: `packages/llm/tests/instructions.test.ts` (new)

**Interfaces:**
- Consumes: `repeated?: true` flows through `panelSlice` automatically (nodes are passed whole) — no slice changes.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Create `packages/llm/tests/instructions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GenerateRequest, OpenAIClient, OpenAIRequestBody } from '../src';
import { openaiGenerator } from '../src/openai';

describe('openaiGenerator instructions', () => {
  it('tells the model a repeated node styles every instance', async () => {
    let captured: OpenAIRequestBody | undefined;
    const client: OpenAIClient = async (body) => {
      captured = body;
      return {
        output: [
          {
            type: 'function_call',
            name: 'emit_overlay',
            arguments: JSON.stringify({ patches: [] }),
          },
        ],
      };
    };

    const request: GenerateRequest = { prompt: 'dark', panelId: 'p/panel#0', panels: {}, dots: {} };
    await openaiGenerator({ client })(request);

    if (!captured) throw new Error('Expected a request body.');
    expect(captured.instructions).toContain('repeated');
    expect(captured.instructions).toContain('every instance');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `corepack pnpm --filter "@dotui/llm" run test`
Expected: the new test FAILS (instructions don't mention "repeated"). The 11 existing tests pass.

- [ ] **Step 3: Implement**

In `packages/llm/src/openai.ts`, inside `createBody`'s `instructions` array, add one line after `'Do not hide required dots. Use hidden:false to reveal authored elements.',`:

```ts
      'Nodes with repeated:true are templates rendered many times (list cards); a patch on such an id restyles every instance.',
```

- [ ] **Step 4: Run tests**

Run: `corepack pnpm --filter "@dotui/llm" run test`
Expected: 12 pass.

- [ ] **Step 5: Package gate + commit**

Run: `corepack pnpm --filter "@dotui/llm" run build`, `… run typecheck`, `corepack pnpm exec biome check packages/llm`
Expected: green.

```bash
git add packages/llm
git commit -m "feat(llm): instruct the model that repeated nodes style every instance

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: YouTube feed → real `.map()` (the proof)

**Files:**
- Modify: `apps/youtube/app/feed.panel.tsx` (full replacement below)
- Modify: `apps/youtube/app/personas.ts` (feed ids → template ids; full replacement of the three overlay consts below)
- Modify: `apps/youtube/app/videos.ts` (top doc comment only)
- Regenerate: `apps/youtube/.dotui/schema.json` (via the app's `schema` script)

**Interfaces:**
- Consumes: Task 2's compiler (rebuild `@dotui/compiler` first if `dist/` is stale) and Task 1's core.
- Produces: template ids used below — `feed/panel#0/panel~0`, `feed/panel#0/panel~0/image#0`, `feed/panel#0/panel~0/text#0` (title), `feed/panel#0/panel~0/text#1` (channel), `feed/panel#0/panel~0/badge#0`. The static id `feed/panel#0` (the grid, referenced by `app/page.tsx`'s `<Promptable panelId="feed/panel#0">`) is unchanged.

- [ ] **Step 1: Replace `apps/youtube/app/feed.panel.tsx` in full**

```tsx
'use client';

import { dot } from '@dotui/elements';
import { VIDEOS, type Video } from './videos';

/**
 * The video grid — ONE card template rendered per video. The card lives inside the
 * `.map()` callback, so the compiler records it once as a repeated template
 * (`feed/panel#0/panel~0`, `repeated: true` in the schema) and stamps that id on the
 * single source element — every rendered card carries it, so overlays and prompts
 * restyle ALL cards together. Before repeated-template support this file hand-copied
 * six static cards; see docs/superpowers/specs/2026-07-06-repeated-dots-design.md.
 */
export function Feed({ onSelect }: { onSelect: (video: Video) => void }) {
  return (
    <dot.panel
      description="The main video feed grid."
      className="grid flex-1 grid-cols-1 gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {VIDEOS.map((video) => (
        <dot.panel
          key={video.id}
          description="Video card (template — one per video)."
          className="flex cursor-pointer flex-col gap-2"
          onClick={() => onSelect(video)}
        >
          <dot.image
            description="Video thumbnail."
            src={video.thumb}
            alt=""
            className="aspect-video w-full rounded-xl object-cover"
          />
          <dot.text
            required
            type="h3"
            description="Video title."
            className="text-sm font-semibold text-slate-900"
          >
            {video.title}
          </dot.text>
          <dot.text description="Channel name." className="text-xs text-slate-600">
            {video.channel}
          </dot.text>
          <dot.badge description="View count and age." className="text-xs text-slate-400">
            {`${video.views} · ${video.age}`}
          </dot.badge>
        </dot.panel>
      ))}
    </dot.panel>
  );
}
```

- [ ] **Step 2: Regenerate the schema and verify the id shape**

```bash
corepack pnpm --filter "@dotui/compiler" run build   # ensure dist/ has Task 2
corepack pnpm --filter "@dotui/youtube" run schema
git diff apps/youtube/.dotui/schema.json | head -80
```

Expected: the diff removes the six per-card entries (`feed/panel#0/panel#0` … `panel#5` and their children) and adds `feed/panel#0/panel~0` (with `"repeated": true`) plus its four children; `feed/panel#0` itself and every `topbar/*`, `sidebar/*`, `frame/*`, `watch/*` id is untouched. **No warnings** in the schema build output.

- [ ] **Step 3: Update `apps/youtube/app/personas.ts`**

Replace the three overlay consts (`young`, `middle`, `elderly`) with:

```ts
/** Young: power user. Everything visible, compact and dense. */
const young: Overlay = {
  'topbar/panel#0/text#0': { className: 'text-base' },
  'sidebar/panel#0/button#0': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#1': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#2': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#3': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#4': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#5': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#6': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#7': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#8': { className: 'px-3 py-1.5 text-xs' },
  'sidebar/panel#0/button#9': { className: 'px-3 py-1.5 text-xs' },
  'feed/panel#0': { className: 'gap-3 p-3' },
  // One template id styles the title on EVERY card (was six per-card entries).
  'feed/panel#0/panel~0/text#0': { className: 'text-xs' },
};

/** Middle-aged: balanced. All sections visible, comfortable sizing. */
const middle: Overlay = {
  'sidebar/panel#0/button#0': { className: 'text-sm' },
  'feed/panel#0': { className: 'gap-5 p-5' },
  'feed/panel#0/panel~0/text#0': { className: 'text-base' },
};

/**
 * Elderly: large, readable, low-clutter. Big text and targets; hide Shorts, the
 * Explore section, the Create action, and the per-card metadata badges.
 *
 * NOTE: the feed cards are now a repeated template, so per-card overrides (the old
 * "show only four cards") are no longer expressible — template styling applies to
 * every instance. Per-instance targeting (dotKey) is a future cycle.
 */
const elderly: Overlay = {
  // Bigger brand + search.
  'topbar/panel#0/text#0': { className: 'text-2xl' },
  'topbar/panel#0/panel#0/input#0': { className: 'text-base py-2.5' },
  'topbar/panel#0/button#0': { hidden: true }, // Create — hidden
  // Sidebar: bigger touch targets; hide the noisy bits.
  'sidebar/panel#0/button#0': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#1': { hidden: true }, // Shorts
  'sidebar/panel#0/button#2': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#3': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#4': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#5': { className: 'text-lg py-3' },
  'sidebar/panel#0/button#6': { className: 'text-lg py-3' },
  'sidebar/panel#0/text#1': { hidden: true }, // "Explore" label
  'sidebar/panel#0/button#7': { hidden: true }, // Trending
  'sidebar/panel#0/button#8': { hidden: true }, // Gaming
  'sidebar/panel#0/button#9': { hidden: true }, // Music
  // Feed: large titles on every card, metadata badges hidden on every card.
  'feed/panel#0/panel~0/text#0': { className: 'text-xl font-bold' },
  'feed/panel#0/panel~0/badge#0': { hidden: true },
};
```

(Leave everything above `young` — imports, `Persona`, `PERSONA_LABELS`, `PERSONA_HINTS`, the file doc comment — and the final `PERSONAS` export untouched.)

- [ ] **Step 4: Update the stale comment in `apps/youtube/app/videos.ts`**

Replace the file's top doc comment with:

```ts
/**
 * The feed's data. Kept here (not inline in the JSX) so the feed cards and the watch page
 * stay in sync from one source — clicking a card hands the same `Video` object to the
 * player. The feed renders these via `.map()` over ONE card template; the compiler gives
 * the template a stable `~` id, so styling applies to every card.
 */
```

- [ ] **Step 5: Verify the app**

```bash
corepack pnpm --filter "@dotui/youtube" run build
corepack pnpm exec biome check apps/youtube
```

Expected: `next build` compiles (the babel plugin stamps the template id — the build itself exercises Task 2's plugin path); biome clean. Then confirm the persona overlays reference only ids that exist:

```bash
node -e "
const schema = require('./apps/youtube/.dotui/schema.json');
const ids = new Set([...Object.keys(schema.panels), ...Object.keys(schema.dots)]);
const src = require('node:fs').readFileSync('./apps/youtube/app/personas.ts', 'utf8');
const referenced = [...src.matchAll(/'([a-z]+\/[^']+)'/g)].map((m) => m[1]);
const missing = referenced.filter((id) => !ids.has(id));
console.log(missing.length === 0 ? 'OK: all persona ids exist' : 'MISSING: ' + missing.join(', '));
process.exit(missing.length === 0 ? 0 : 1);
"
```

Expected: `OK: all persona ids exist`.

- [ ] **Step 6: Commit**

```bash
git add apps/youtube
git commit -m "feat(youtube): feed cards are a repeated template via .map()

Six hand-copied static cards become one mapped card template
(feed/panel#0/panel~0); personas restyle every card through the template id.
Per-card hiding (elderly's 'show only four cards') gives way to template
semantics per the approved spec.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Docs + full gate

**Files:**
- Modify: `ARCHITECTURE.md` (stale `.map()` invariant)
- Modify: `packages/compiler/README.md` (gotcha paragraph + id scheme)
- Modify: `PROGRESS.md` (new status section)
- Check: `SKILLS.md` (grep for stale `.map()` claims; fix any found the same way)

**Interfaces:** none — documentation and the final verification gate.

- [ ] **Step 1: Update `ARCHITECTURE.md`**

In "Invariants worth knowing", replace the bullet

```
- **Author panels as static JSX** — ids are source-position-based; `.map()`
  collapses every card onto one id.
```

with:

```
- **Lists are templates.** A dot inside a `.map()` callback gets ONE `~`-marked
  id (`feed/panel#0/panel~0`, `repeated: true` in the schema); every rendered
  instance carries it, so styling applies to all instances together.
  Conditionals (`{cond && <dot.x/>}`) work the same way without the repeated
  flag. Unsupported expression shapes produce a build warning. Per-instance
  targeting and shared components are future work.
```

- [ ] **Step 2: Update `packages/compiler/README.md`**

Replace its final gotcha paragraph

```
Gotcha: ids are source-position-based, so author panels as static JSX. A shared
card component or a `.map()` collapses every instance onto a single id.
```

with:

```
`.map()` and conditionals are supported: dots inside them get `~`-marked ids in
their own counter namespace (`feed/panel#0/panel~0`) so static ids never shift;
function-boundary dots carry `repeated: true` (one template, N instances — one
overlay patch styles them all), and unsupported expression shapes produce build
warnings. Shared components (a card component reused across panels) still
collapse onto their defining file's ids — that's future work.
```

- [ ] **Step 3: Check SKILLS.md for stale claims**

Run: `grep -n "map\|static JSX" SKILLS.md | grep -iv "sitemap"`
For any line claiming `.map()` is unsupported/forbidden or that panels must be static JSX, update it to the new truth (template ids, `~` marker, repeated flag). If nothing matches, move on.

- [ ] **Step 4: Add the PROGRESS.md status section**

Insert before `### ⬜ Remaining / follow-ups`:

```markdown
### ✅ Repeated & conditional dots — .map() works now (2026-07-06, verified)
- **The compiler descends panel expression children**: dots inside `.map()`
  callbacks, ternaries, and `&&`/`||`/`??` get ids in a separate `~` namespace
  (`feed/panel#0/panel~0`) — static `#` ids provably unchanged (locked by an
  id-stability test). Function-boundary dots are `repeated: true` in the schema:
  ONE template element, stamped once, so an overlay patch styles every rendered
  instance. Unsupported expression shapes produce build warnings, never silent
  unstyleable elements. Spec: `docs/superpowers/specs/2026-07-06-repeated-dots-design.md`.
- `assignDotIds` now returns `{ ids, repeated, unsupported }`; `@dotui/core`
  nodes gained additive `repeated?: true` (format version still 1); the OpenAI
  instructions explain template semantics; `@dotui/elements` needed zero changes.
- **Proof:** the YouTube feed is a real `VIDEOS.map()` over one card template
  (was six hand-copied cards); personas restyle every card via the template id.
  Per-card hiding (elderly's "show only four cards") is gone by design —
  template-only granularity in v1; `dotKey` per-instance targeting is a future
  cycle, as are shared components.
- **Verified:** 75 tests pass (core 9, compiler 20, elements 13, guardrail 4,
  devtools 3, store 9, llm 12, prompt 5); demo + gmail schemas byte-identical;
  youtube schema regenerated with the template ids and `next build` compiles;
  lint clean.
```

- [ ] **Step 5: Final gate**

```bash
corepack pnpm run build        # all packages
corepack pnpm run test         # expect 75 tests: core 9, compiler 20, elements 13, guardrail 4, devtools 3, store 9, llm 12, prompt 5
corepack pnpm run typecheck
corepack pnpm run lint         # exit 0
corepack pnpm --filter "@dotui/youtube" run build
corepack pnpm --filter "@dotui/gmail" run build
```

Expected: everything green. If the test total isn't 75, list the per-package counts and reconcile before committing (the per-package numbers are authoritative).

- [ ] **Step 6: Commit**

```bash
git add ARCHITECTURE.md PROGRESS.md packages/compiler/README.md SKILLS.md
git commit -m "docs: repeated-template semantics — .map() is supported now

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review notes (already applied)

- **Spec coverage:** walk descent + `~` ids + repeated flag + warnings (Task 2), additive core flag (Task 1), LLM instruction (Task 3), YouTube proof incl. persona migration + id-existence check (Task 4), docs + gate incl. demo/gmail byte-identical schemas (Tasks 2/5). Elements untouched, per spec.
- **Type consistency:** `DotIdAssignment { ids, repeated, unsupported }` defined in Task 2 matches its uses in extract/plugin/index; `makeSegment(kind, index, marker)` matches walk usage; template ids in Tasks 2/4 use the same `kind~index` shape; `repeated?: true` (Task 1) matches the `true as const` spreads (Task 2) and the Zod literal.
- **Known risks for implementers:** (1) the existing 14 compiler tests are the static-behavior contract — if any fails, fix the walk; (2) `feed/panel#0` must remain the grid's id or `app/page.tsx`'s `<Promptable>` breaks — the id-existence script in Task 4 Step 5 catches persona drift but page.tsx is static-id-safe by construction; (3) `key={video.id}` on `dot.panel` is React-reserved and never reaches props — no dotUI handling needed.
