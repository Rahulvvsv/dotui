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
  - `onDeleteVisual(visual)` — persist the removal of a saved visual (e.g.
    DELETE to a store-backed endpoint); omit for in-memory-only deletion.
- `Promptable panelId` — wraps one panel: inline ✨ prompt box in edit mode,
  registers the panel for global runs, shows the animated highlight while the
  generator works on it. `showControl={false}` registers without the button
  (background/root panels).
- **Built-in UX:** a session undo stack (↩ Undo, per-panel ⟲ reset, ⟲ Reset
  all — all return to the page-load `initialOverlay` and fire `onApplied`),
  toast notifications for generation failures and guardrail-dropped classes,
  n-of-m progress with a Stop button during global runs, and keyboard/screen-
  reader support (aria-labels, Escape-to-close with focus return, polite live
  region). All chrome CSS is namespaced and injected — no Tailwind safelist
  needed for it.
- Global runs go panel-by-panel top-down, threading the accumulated overlay as
  `current` so later panels match earlier styling; the screen repaints as it goes.
- `mergeOverlay` — re-export of `@dotui/core`'s (successive prompts stack).

## Example

```tsx
const generate = (args) =>
  fetch('/api/generate', { method: 'POST', body: JSON.stringify(args) }).then((r) => r.json());

const onApplied = (overlay) =>
  fetch('/api/overlay', {
    method: 'POST',
    body: JSON.stringify({ panelId: 'app', overlay }),
  });

<DotuiPromptProvider generate={generate} initialOverlay={persisted} onApplied={onApplied}>
  <Promptable panelId="home/panel#0"><Home /></Promptable>
</DotuiPromptProvider>
```
