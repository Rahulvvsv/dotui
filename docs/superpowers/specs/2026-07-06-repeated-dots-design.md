# dotUI v2 — Repeated & conditional dots (transparent descent)

**Date:** 2026-07-06
**Branch:** `feat/repeated-dots` (based on `refactor/package-cleanup`)
**Status:** approved design, pre-implementation

## Problem

Dots produced inside expression containers are invisible to the whole system.
In `<dot.panel>{videos.map(v => <dot.panel>…</dot.panel>)}</dot.panel>` the
mapped dots get **no id at all**: `assignDotIds` only recurses through a
panel's direct JSX-element children, extraction silently skips expression
containers, and the Babel plugin stamps only what the walk assigned. The dots
render but cannot be described in the schema, targeted by the LLM, or styled
by any overlay. The same applies to conditionals (`{cond && <dot.badge/>}`).
This forces every list to be hand-authored static JSX (the persona apps
copy-paste 6 cards each) and makes real data-driven UIs impossible — an
existential limitation.

## Decisions locked

- **Template-only granularity (v1).** A repeated dot's overlay applies to ALL
  rendered instances. No per-instance targeting; a `dotKey` mechanism may come
  later. Where per-instance hiding matters (personas hiding specific cards),
  static JSX remains the tool.
- **Shared components are OUT of scope.** A `<Card/>` used in several panels
  still gets ids scoped to its defining file; cross-usage id composition is a
  future cycle.
- **Approach: transparent compiler descent** (no new authoring API, no
  `dot.repeat` wrapper). Authors write ordinary React.

## Design

### 1. Walk (`packages/compiler/src/walk.ts`) — the only place ids are born

When a panel child is a `JSXExpressionContainer`, descend into exactly three
expression shapes, recursively:

1. **Function bodies** — arrow functions and function expressions anywhere in
   the expression (e.g. the callback of `.map(...)`, regardless of the method
   name). Crossing a function boundary sets a `repeated` flag for every dot
   found beneath it.
2. **Conditional (ternary) expressions** — both consequent and alternate.
3. **Logical expressions** (`&&`, `||`, `??`) — the right-hand side.

Rules:

- Dot elements found via expression descent get ids in a **separate counter
  namespace** using a `~` marker: `feed/panel#0/panel~0`. Static `#` counters
  never see expression-nested dots, so **every existing static id stays
  byte-identical** — no persisted overlay breaks. The `~` also makes
  template-ness readable off the id.
- The `~` counters are per parent panel and per kind, exactly like `#`
  counters, and increment in source order across all of that panel's
  expression children.
- Inside a discovered dot, its own subtree is normal static structure: normal
  recursion, normal `#` ids (`feed/panel#0/panel~0/text#0`). Nested maps
  compose: a map directly inside a template panel yields
  `feed/panel#0/panel~0/panel~0` — each parent has its own `~` namespace.
- Descent stops at the first dot element found (its subtree belongs to the
  normal per-panel recursion), mirroring `findRootDots`' pruning.
- A dot element reachable only through any **other** expression shape (call
  results without inline function bodies, `new`, IIFE results, member chains,
  etc.) is NOT assigned an id; the walk reports it so extraction emits a
  **build warning naming the element** ("dot.x inside an unsupported
  expression is not addressable — use .map()/ternary/&&, or author it
  statically"). Never silent invisibility.
- Only panels descend into expressions. Non-panel dots keep current behavior
  (children are content; nested dots there remain a warning).
- `findRootDots` needs no semantic change (it already walks all expressions
  via VISITOR_KEYS and prunes at dot roots).

The walk's public contract grows: `assignDotIds(roots, scope)` now returns
`{ ids: Map<t.JSXElement, string>, repeated: Set<t.JSXElement>, unsupported: t.JSXElement[] }`
instead of the bare `Map`. Both in-package consumers (`extract.ts`,
`plugin.ts`) and the compiler tests update to the new shape; nothing outside
`@dotui/compiler` touches this function.

### 2. Schema (`@dotui/core`)

`DotNode` and `PanelNode` gain optional `repeated?: true` — set only when the
element sits beneath a function boundary. Conditional-only dots are ordinary
dots that may not render (no flag). Zod schemas updated to accept the
optional field. Schema format version stays **1** (additive change; existing
schema files remain valid).

### 3. Extraction and plugin — free, by construction

Both consume the shared walk:

- `extract.ts` records expression-nested dots in the parent panel's
  `children` array in source order, with `repeated: true` where flagged, and
  their content as today (`{v.title}` is already a `dynamic` content part).
  Unsupported-expression dots become warnings.
- `plugin.ts` stamps the template element once; all N rendered instances come
  from that one source element, so **every instance carries the template id
  with zero runtime changes**.
- `@dotui/elements` does not change. N instances read the same override; a
  hidden template hides all instances. React `key` stays the author's normal
  responsibility.

### 4. LLM contract (`@dotui/llm`)

`repeated` flows through panel slices automatically (slices carry whole
nodes). Add one instruction line in `openai.ts`: a patch on a node marked
`repeated` styles all instances of that element. The mock generator needs no
change (it styles by kind).

### 5. Proof and tests

- **Real proof:** convert the YouTube app's feed panel to `videos.map(...)`
  over a data array (replacing the ~6 hand-copied card blocks). Verify:
  the regenerated schema contains the template ids; a persona overlay and a
  live prompt each restyle ALL cards; the topbar/sidebar ids (untouched
  panels) are byte-identical to the previous schema. Note: the youtube
  persona overlays that referenced per-card feed ids must be updated to
  template ids as part of the conversion — expected and acceptable (feed
  per-card hiding gives way to template semantics; per-card cases that must
  survive stay static).
- **Unit tests** (compiler): map, ternary, `&&`, nested map, unsupported
  shape warning, plugin ≡ extractor id equality for expression dots, and an
  **id-stability test** — a mixed panel (static dots + a map) asserting the
  static dots' ids are identical to the same panel without the expression.
- **Gate:** all existing tests (66) stay green; youtube app builds; schema
  regeneration for demo/gmail produces byte-identical output (no expressions
  in those sources today).

## Out of scope

- Per-instance targeting (`dotKey`), shared-component id composition,
  devtools UI for templates, LLM strategy changes, DB/server-layer changes.
