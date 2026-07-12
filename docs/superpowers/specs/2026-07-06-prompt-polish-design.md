# dotUI v2 — Prompt-layer polish + per-user overlays

**Date:** 2026-07-06
**Branch:** continues on `feat/repeated-dots` lineage (new branch `feat/prompt-polish`)
**Status:** approved design, pre-implementation

## Problem

The end-user prompt experience has five sharp edges, and persistence has one
privacy bug:

1. **No undo.** `mergeOverlay` stacks every prompt forever; a bad prompt can
   only be escaped via persona switch or a saved visual.
2. **Failures are invisible.** A failed `/api/generate` call rejects into
   nowhere (`runPanel`/`runGlobal` have no catch); guardrail-dropped classes
   (`dropped`) reach `PromptResult` and are discarded. Users can't tell
   "failed" from "no change".
3. **Saved visuals are immortal.** `deleteVisual` exists in the store (tested)
   but no UI exposes it.
4. **Global runs are opaque.** No "panel 3 of 10", no cancel, inputs stay
   enabled during runs.
5. **The injected UI isn't keyboard/screen-reader friendly.** No aria-labels,
   no Escape-to-close, no live region.
6. **All users share one look.** All three apps (gmail, demo, AND youtube —
   verified: youtube has its own `/api/overlay` + `lib/store.ts`) persist and
   serve overlays (and gmail's visuals) under the literal scope `'default'`;
   one browser's edits become every visitor's UI. The user explicitly does
   not want this.

## Decisions locked

- **Approach: extend `@dotui/prompt` in place.** New focused hooks
  (`useUndoStack`, `useToasts`) beside the existing `useSavedVisuals`; no new
  packages; one new optional provider prop (`onDeleteVisual`).
- **Undo model: session undo stack** (in-memory snapshots in the provider).
  Independent of persistence; `onApplied` fires after undo/reset so persisting
  hosts stay in sync. Lost on reload by design — saved visuals remain the
  durable bookmarks. DB-backed timelines stay a deferred follow-up.
- **Per-user identity: anonymous cookie**, no auth system. Store `scope`
  parameter (already on every method) carries it.

## Design

### 1. Undo & reset (`use-undo-stack.ts`)

Provider keeps `history: Overlay[]`. A snapshot of the current overlay is
pushed **before** each mutation: a panel prompt patch, a global-run completion
(one snapshot per whole run, pushed before the first panel), a visual
selection, and a reset. Cap 25 (drop oldest).

- **Undo** pops: `setOverlay(prev)`, `onApplied(prev)`, clears
  `activeVisualId`. Button in the global control shows depth ("↩ Undo (3)"),
  disabled at zero.
- **Reset panel** (button beside the inline ✨ prompt form): for every id in
  the live overlay belonging to that panel (the panel id itself + every id
  prefixed `panelId + '/'`), remove the entry, then restore that panel's
  entries from `initialOverlay`. Pushes to history first.
- **Reset all** (in the global control): overlay := `initialOverlay`
  wholesale. Pushes to history first.

Hook contract: `useUndoStack({ overlay, setOverlay, onApplied, initialOverlay,
clearActiveVisual })` → `{ canUndo, depth, push, undo, resetPanel, resetAll }`.
Global runs call `push` once before the loop; `runPanel` before applying its
patch; `selectVisual` before replacing.

### 2. Feedback toasts (`use-toasts.ts` + styles)

Toast stack rendered above the floating control, styled via the existing
namespaced-CSS `<style>` injection (PROMPT_STYLES) — no Tailwind safelist
involvement. Container is `role="status"` `aria-live="polite"`.

Events:
- **Generation error:** `runPanel`/`runGlobal` wrap `generate` in try/catch —
  toast "Couldn't restyle this panel — try again." (kind `error`); `busy`
  always cleared; the run loop stops on error (already-applied panels stay).
- **Guardrail drops:** when a result's `dropped` is non-empty, toast
  "Skipped disallowed styles: <unique class list, max ~5 shown>" (kind `info`),
  aggregated per run (one toast, not one per panel).
- **Cancel confirmation:** "Stopped after N of M panels." (kind `info`).

Hook contract: `useToasts()` → `{ toasts, addToast(kind, message), dismiss(id) }`.
Auto-dismiss 6 s; click dismisses; max 4 visible (oldest dropped).

### 3. Global-run progress & cancel

`runGlobal` snapshots the registered panel list, then exposes progress
`{ done, total }` in context while running; the control shows
"Styling panel 3 of 10…" and a **Stop** button that sets a cancelled ref —
the loop checks it before each panel, finishes the in-flight one, then stops
(applied panels stay applied) and toasts the cancel message. All prompt
inputs and run-triggering buttons are `disabled` while `busy` (global form,
inline ✨ forms, visual chips, undo/reset).

### 4. Saved-visual delete

Each chip gains a small ✕ (`aria-label="Delete visual <name>"`). First click
arms it (chip shows "sure?"), second click within 3 s deletes; otherwise it
disarms. Deletion: remove from local list; if the new optional
`onDeleteVisual(visual)` provider prop is present, await it (host persists the
delete). gmail wires it to a new `DELETE /api/visuals?id=<n>` route calling
the store's existing `deleteVisual`; youtube passes nothing (in-memory only).
If the active visual is deleted, `activeVisualId` clears (live overlay is
untouched).

### 5. Accessibility pass (injected UI only)

- aria-labels on: floating "✨ Edit UI" toggle, close ✕, inline panel ✨
  openers ("Restyle <panelId> by prompt"), submit buttons, undo/reset, chip ✕.
- Escape closes the open edit panel / inline popover and returns focus to the
  button that opened it.
- Toast container is the live region (above); the "styling…" badge gets
  `aria-hidden` (progress is announced via the control's text instead).
- The watch up-next row a11y follow-up (recorded earlier) is folded in:
  `role="button" tabIndex={0} onKeyDown` (Enter/Space) on the template panel
  in `apps/youtube/app/watch.panel.tsx` — pure app-code change.

### 6. Per-user overlays (gmail + demo + youtube)

- `middleware.ts` in each of the three apps: if the `dotui_uid` cookie is
  absent, set it (httpOnly, sameSite lax, 1-year maxAge,
  value `crypto.randomUUID()`).
- A tiny server helper per app (`lib/scope.ts`): `overlayScope()` → cookie
  value via `next/headers` cookies(), falling back to `'default'` when absent
  (belt-and-braces; middleware runs first in practice).
- Layout/page reads: gmail `layout.tsx` (`current(scope)` + `listVisuals(scope)`),
  youtube `layout.tsx` (`current(scope)`), demo `page.tsx` (`current(scope)`).
- `app/api/overlay/route.ts` (all three apps): GET and POST use the scope for
  `current`/`list`/`save` (save gains `scope` in its args).
- `app/api/visuals/route.ts` (gmail): GET/POST/DELETE use the scope; DELETE
  verifies the visual belongs to the scope before deleting (list + check id).
- Schema snapshots (`saveSchema`) stay global. Old `'default'` rows simply
  stop being served; no migration.

### 7. Testing

Prompt package (existing render/fire/waitFor pattern):
- undo restores the pre-prompt overlay; depth label updates; disabled at 0.
- reset panel restores `initialOverlay` for that panel's ids only (a second
  panel's override survives).
- failing `generate` → error toast visible, `busy` cleared, no overlay change.
- result with `dropped` → info toast listing the class.
- global run over 2 panels with cancel after the first → only first patch
  applied + cancel toast.
- visual chip ✕ → arm + confirm removes chip and calls `onDeleteVisual`.

Store/app: no new store methods (deleteVisual already tested). gmail/demo
verified by `next build` plus a live smoke: two different cookie jars POST
different overlays and each GET returns its own.

## Out of scope

DB-backed undo timeline, `@dotui/next` extraction (routes stay hand-wired
until the server-layer cycle), auth/accounts, toast theming API, dev-adoption
safety net (separate slice), LLM call strategy.
