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
