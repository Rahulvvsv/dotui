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
