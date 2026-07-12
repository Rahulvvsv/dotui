# Prompt-Layer Polish + Per-User Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Undo/reset, failure & guardrail-drop toasts, global-run progress + cancel, saved-visual delete, an a11y pass on the injected UI, and per-user (cookie-scoped) overlay persistence in all three apps.

**Architecture:** All UX work extends `@dotui/prompt` in place: two new hooks (`useToasts`, `useUndoStack`) beside the existing `useSavedVisuals`, a `Toasts` component, and grown `Control`/`Promptable`. Apps change only for scoping (middleware + `lib/scope.ts` + routes/layouts) and one new provider prop wire-up. Spec: `docs/superpowers/specs/2026-07-06-prompt-polish-design.md` (as amended: youtube persists too).

**Tech Stack:** React 19, Next.js 15 (async `cookies()` from `next/headers`; middleware), vitest + @testing-library/react, Drizzle/libSQL via `@dotui/store` (no store changes — `scope` params already exist on every method).

## Global Constraints

- **NO bare `pnpm` on PATH** — every pnpm command MUST be `corepack pnpm …`. Repo root `C:\Users\rvish\Downloads\dotUI\dotui-v2`, branch `feat/prompt-polish`.
- Existing tests must pass unmodified. Current totals: 76 (core 9, compiler 21, elements 13, guardrail 4, devtools 3, store 9, llm 12, prompt 5). Expected when done: **83** (prompt 5 → 12; nothing else moves).
- The prompt layer stays **apply-only**: it never talks to a DB; persistence flows through `onApplied`/`onSaveVisual`/`onDeleteVisual` host callbacks.
- Injected chrome styling: extend the namespaced-CSS `PROMPT_STYLES` string (never Tailwind classes that would need a host safelist) for NEW chrome (toasts); existing Control/Promptable Tailwind classes stay as-is (hosts already scan `packages/prompt/src`).
- Store scope: reads/writes use the `dotui_uid` cookie value, falling back to `'default'`. `saveSchema` stays scope-less (global).
- Biome style: single quotes, semicolons, 2-space indent, width 100. Gate each package task with `corepack pnpm exec biome check <path>`.
- Every commit message ends with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: `@dotui/prompt` — toasts + error/dropped surfacing

**Files:**
- Create: `packages/prompt/src/use-toasts.ts`
- Create: `packages/prompt/src/toasts.tsx`
- Modify: `packages/prompt/src/styles.ts` (append toast CSS)
- Modify: `packages/prompt/src/provider.tsx` (full replacement below — error catches, dropped summary, Toasts render)
- Test: `packages/prompt/tests/polish.test.tsx` (new)

**Interfaces:**
- Consumes: existing `PromptResult` (`{ overlay, dropped? }`) — `dropped` finally gets used.
- Produces: `useToasts(): { toasts: Toast[]; addToast(kind: 'error' | 'info', message: string): void; dismiss(id: number): void }` with `type Toast = { id: number; kind: ToastKind; message: string }`; `<Toasts toasts onDismiss />`; module-level `droppedSummary(dropped): string | null` in provider.tsx (Task 2's rewrite keeps all of this).

- [ ] **Step 1: Write the failing tests**

Create `packages/prompt/tests/polish.test.tsx`:

```tsx
import { dot } from '@dotui/elements';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Promptable } from '../src/promptable';
import { DotuiPromptProvider } from '../src/provider';
import type { PromptResult } from '../src/types';

const PANEL = 'demo/panel#0';

function renderOne(generate: (args: { prompt: string; panelId: string }) => Promise<PromptResult>) {
  return render(
    <DotuiPromptProvider generate={generate}>
      <Promptable panelId={PANEL}>
        <dot.panel __dotId={PANEL} className="p-2">
          content
        </dot.panel>
      </Promptable>
    </DotuiPromptProvider>,
  );
}

function promptGlobally(value: string) {
  fireEvent.click(screen.getByText('✨ Edit UI'));
  fireEvent.change(screen.getByPlaceholderText(/make everything/i), { target: { value } });
  fireEvent.click(screen.getByText('Apply'));
}

describe('failure and guardrail feedback', () => {
  it('shows an error toast when generation fails and clears busy', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('boom'));
    const { container } = renderOne(generate);
    promptGlobally('redden');
    await waitFor(() => expect(screen.getByText(/could not/i)).toBeTruthy());
    // busy cleared: the global input is enabled again and no overlay was applied
    expect(screen.getByPlaceholderText<HTMLInputElement>(/make everything/i).disabled).toBe(false);
    expect(container.querySelector('.bg-red-500')).toBeNull();
  });

  it('surfaces guardrail-dropped classes as an info toast', async () => {
    const generate = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
      Promise.resolve({
        overlay: { [panelId]: { className: 'text-lg' } },
        dropped: { [panelId]: ['shadow-2xl'] },
      });
    renderOne(generate);
    promptGlobally('shadows please');
    await waitFor(() => expect(screen.getByText(/shadow-2xl/)).toBeTruthy());
    expect(screen.getByText(/skipped disallowed styles/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `corepack pnpm --filter "@dotui/prompt" run test`
Expected: both new tests FAIL (no toast elements exist; the rejection currently escapes as an unhandled error). The 5 existing tests pass.

- [ ] **Step 3: Implement the toast hook**

Create `packages/prompt/src/use-toasts.ts`:

```ts
'use client';

import { useCallback, useRef, useState } from 'react';

export type ToastKind = 'error' | 'info';
export type Toast = { id: number; kind: ToastKind; message: string };

const AUTO_DISMISS_MS = 6000;
const MAX_VISIBLE = 4;

/**
 * Self-expiring notification queue for the prompt layer's own chrome: generation
 * failures, guardrail drops, and cancel confirmations. Newest last; capped.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, kind, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return { toasts, addToast, dismiss };
}
```

- [ ] **Step 4: Implement the toast stack component**

Create `packages/prompt/src/toasts.tsx`:

```tsx
'use client';

import type { Toast } from './use-toasts';

/**
 * The prompt layer's notification stack. A polite live region so screen readers
 * announce failures and guardrail drops; each toast is a button — click to dismiss.
 */
export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="dotui-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`dotui-toast dotui-toast--${toast.kind}`}
          onClick={() => onDismiss(toast.id)}
          aria-label={`Dismiss notification: ${toast.message}`}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Append toast CSS to `packages/prompt/src/styles.ts`**

Add inside the template string, just before the closing backtick:

```
.dotui-toasts {
  position: fixed;
  bottom: 16px;
  left: 352px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
}
.dotui-toast {
  border: 1px solid;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18);
  animation: dotui-badge-in 0.2s ease-out both;
}
.dotui-toast--error { background: #fef2f2; border-color: #fca5a5; color: #b91c1c; }
.dotui-toast--info { background: #eef2ff; border-color: #c7d2fe; color: #3730a3; }
```

- [ ] **Step 6: Rewire the provider (full replacement)**

Replace `packages/prompt/src/provider.tsx` with:

```tsx
'use client';

import type { Overlay } from '@dotui/core';
import { mergeOverlay } from '@dotui/core';
import { DotOverlayProvider } from '@dotui/elements';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PromptContext } from './context';
import { Control } from './control';
import { PROMPT_STYLES } from './styles';
import { Toasts } from './toasts';
import type { DotuiPromptProviderProps } from './types';
import { useSavedVisuals } from './use-saved-visuals';
import { useToasts } from './use-toasts';

/** One human-readable line for the classes the guardrail refused, or null if none. */
export function droppedSummary(dropped: Record<string, string[]> | undefined): string | null {
  const classes = [...new Set(Object.values(dropped ?? {}).flat())];
  if (classes.length === 0) return null;
  const shown = classes.slice(0, 5).join(', ');
  return `Skipped disallowed styles: ${shown}${classes.length > 5 ? ', …' : ''}`;
}

/**
 * Wraps an app in the prompt layer: holds the live overlay, renders a
 * DotOverlayProvider so every dot picks it up, and shows the floating ✨ control.
 * End-users prompt a single panel (via `<Promptable>`) or all panels (global box);
 * each prompt is generated by the app-supplied `generate` and merged into the
 * overlay live. Failures and guardrail drops surface as toasts instead of
 * disappearing. Saved visuals (named whole-UI snapshots) live in useSavedVisuals.
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

  const { toasts, addToast, dismiss } = useToasts();

  const { visuals, activeVisualId, saveVisual, selectVisual, clearActiveVisual } = useSavedVisuals({
    initial: savedVisuals,
    onSaveVisual,
    onApplied,
    overlay,
    setOverlay,
  });

  const runPanel = useCallback(
    async (panelId: string, prompt: string) => {
      if (!prompt.trim()) return;
      setBusy(true);
      setActivePanelId(panelId);
      try {
        const result = await generate({ prompt, panelId, current: overlay });
        const next = mergeOverlay(overlay, result.overlay);
        setOverlay(next);
        clearActiveVisual(); // the look no longer matches any saved snapshot
        const summary = droppedSummary(result.dropped);
        if (summary) addToast('info', summary);
        await onApplied?.(next);
      } catch {
        addToast('error', 'Could not restyle this panel — try again.');
      } finally {
        setBusy(false);
        setActivePanelId(null);
      }
    },
    [generate, overlay, onApplied, clearActiveVisual, addToast],
  );

  const runGlobal = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      setBusy(true);
      const droppedAll = new Set<string>();
      try {
        // One panel at a time, in registration (top-down) order. Each call gets the
        // overlay accumulated so far as `current`, so a later panel can match the
        // styling already chosen for earlier ones. We apply after every panel so the
        // screen repaints panel-by-panel, highlighting the one being worked on.
        let acc = overlay;
        for (const id of registered.current) {
          setActivePanelId(id);
          const result = await generate({ prompt, panelId: id, current: acc });
          acc = mergeOverlay(acc, result.overlay);
          setOverlay(acc);
          for (const classes of Object.values(result.dropped ?? {})) {
            for (const cls of classes) droppedAll.add(cls);
          }
        }
        clearActiveVisual();
        const summary = droppedSummary(droppedAll.size ? { run: [...droppedAll] } : undefined);
        if (summary) addToast('info', summary);
        await onApplied?.(acc);
      } catch {
        addToast('error', 'Could not finish the global restyle — try again.');
      } finally {
        setBusy(false);
        setActivePanelId(null);
      }
    },
    [generate, overlay, onApplied, clearActiveVisual, addToast],
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
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </PromptContext.Provider>
  );
}
```

Note: a run that fails mid-global-loop keeps already-applied panels (each iteration already called `setOverlay`) and does NOT call `onApplied` — the host's persisted state stays at the last completed run, which is the conservative choice.

- [ ] **Step 7: Run tests**

Run: `corepack pnpm --filter "@dotui/prompt" run test`
Expected: 7 pass (5 existing + 2 new).

- [ ] **Step 8: Package gate + commit**

Run: `corepack pnpm --filter "@dotui/prompt" run build`, `… run typecheck`, `corepack pnpm exec biome check packages/prompt`
Expected: green.

```bash
git add packages/prompt
git commit -m "feat(prompt): toasts — generation failures and guardrail drops are visible

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `@dotui/prompt` — undo/reset, progress/cancel, visual delete, a11y

**Files:**
- Create: `packages/prompt/src/use-undo-stack.ts`
- Modify: `packages/prompt/src/use-saved-visuals.ts` (full replacement: `onBeforeChange`, `onDeleteVisual`, `deleteVisual`)
- Modify: `packages/prompt/src/types.ts` (add `onDeleteVisual` prop; extend `PromptContextValue`)
- Modify: `packages/prompt/src/provider.tsx` (full FINAL replacement below)
- Modify: `packages/prompt/src/control.tsx` (full FINAL replacement below)
- Modify: `packages/prompt/src/promptable.tsx` (full FINAL replacement below)
- Test: `packages/prompt/tests/polish.test.tsx` (append 5 tests)

**Interfaces:**
- Consumes: Task 1's `useToasts`/`Toasts`/`droppedSummary` (unchanged).
- Produces: `useUndoStack({ overlay, setOverlay, onApplied, initialOverlay, clearActiveVisual })` → `{ canUndo: boolean; depth: number; push(snapshot: Overlay): void; undo(): Promise<void>; resetPanel(panelId: string): Promise<void>; resetAll(): Promise<void> }`. `DotuiPromptProviderProps.onDeleteVisual?: (visual: SavedVisual) => void | Promise<void>`. `PromptContextValue.resetPanel: (panelId: string) => void`. Task 3 wires `onDeleteVisual` in gmail.

- [ ] **Step 1: Append the failing tests**

Append to `packages/prompt/tests/polish.test.tsx`:

```tsx
describe('undo and reset', () => {
  const redden = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
    Promise.resolve({ overlay: { [panelId]: { className: 'bg-red-500' } } });

  it('undo restores the pre-prompt overlay', async () => {
    const { container } = renderOne(redden);
    promptGlobally('redden');
    await waitFor(() => expect(container.querySelector('.bg-red-500')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    await waitFor(() => expect(container.querySelector('.bg-red-500')).toBeNull());
  });

  it('reset panel restores initialOverlay for that panel only', async () => {
    const { container } = render(
      <DotuiPromptProvider generate={redden} initialOverlay={{ 'a/panel#0': { className: 'p-9' } }}>
        <Promptable panelId="a/panel#0">
          <dot.panel __dotId="a/panel#0">a</dot.panel>
        </Promptable>
        <Promptable panelId="b/panel#0">
          <dot.panel __dotId="b/panel#0">b</dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );
    promptGlobally('redden');
    await waitFor(() => expect(container.querySelectorAll('.bg-red-500')).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: 'Restyle a/panel#0 by prompt' }));
    fireEvent.click(screen.getByRole('button', { name: /reset a\/panel#0/i }));
    await waitFor(() => expect(container.querySelectorAll('.bg-red-500')).toHaveLength(1));
    expect(container.querySelector('.p-9')).toBeTruthy(); // a is back to its page-load look
  });
});

describe('global-run progress and cancel', () => {
  it('stop ends the run after the in-flight panel', async () => {
    const resolvers: Array<() => void> = [];
    const generate = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
      new Promise((resolve) => {
        resolvers.push(() => resolve({ overlay: { [panelId]: { className: 'bg-red-500' } } }));
      });

    const { container } = render(
      <DotuiPromptProvider generate={generate}>
        <Promptable panelId="a/panel#0">
          <dot.panel __dotId="a/panel#0">a</dot.panel>
        </Promptable>
        <Promptable panelId="b/panel#0">
          <dot.panel __dotId="b/panel#0">b</dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );
    promptGlobally('redden');

    const stop = await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(stop); // cancel while panel 1 is in flight
    resolvers[0]?.(); // panel 1 finishes and applies; loop then sees the flag

    await waitFor(() => expect(screen.getByText(/stopped after 1 of 2/i)).toBeTruthy());
    expect(container.querySelectorAll('.bg-red-500')).toHaveLength(1);
    expect(resolvers).toHaveLength(1); // panel 2 was never requested
  });
});

describe('saved-visual delete', () => {
  it('arms then deletes, calling onDeleteVisual', async () => {
    const onDeleteVisual = vi.fn();
    const gen = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
      Promise.resolve({ overlay: { [panelId]: {} } });
    render(
      <DotuiPromptProvider
        generate={gen}
        savedVisuals={[{ id: 7, name: 'Calm', overlay: {} }]}
        onDeleteVisual={onDeleteVisual}
      >
        <Promptable panelId={PANEL}>
          <dot.panel __dotId={PANEL}>content</dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );
    fireEvent.click(screen.getByText('✨ Edit UI'));
    const del = screen.getByRole('button', { name: 'Delete visual Calm' });
    fireEvent.click(del); // arm
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Calm' }));
    await waitFor(() => expect(onDeleteVisual).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Calm')).toBeNull();
  });
});

describe('keyboard access', () => {
  it('Escape closes the inline prompt popover', async () => {
    const gen = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
      Promise.resolve({ overlay: { [panelId]: {} } });
    renderOne(gen);
    fireEvent.click(screen.getByText('✨ Edit UI'));
    fireEvent.click(screen.getByRole('button', { name: `Restyle ${PANEL} by prompt` }));
    const input = screen.getByPlaceholderText(/restyle this panel/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByPlaceholderText(/restyle this panel/i)).toBeNull());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `corepack pnpm --filter "@dotui/prompt" run test`
Expected: the 5 new tests FAIL (no undo/reset/stop/delete buttons, opener has no aria-label, Escape does nothing). The 7 from Task 1 pass.

- [ ] **Step 3: Create `packages/prompt/src/use-undo-stack.ts`**

```ts
'use client';

import type { Overlay } from '@dotui/core';
import { useCallback, useState } from 'react';
import type { DotuiPromptProviderProps } from './types';

const MAX_DEPTH = 25;

type Args = {
  overlay: Overlay;
  setOverlay: (overlay: Overlay) => void;
  onApplied: DotuiPromptProviderProps['onApplied'];
  initialOverlay: Overlay;
  clearActiveVisual: () => void;
};

function belongsTo(id: string, panelId: string): boolean {
  return id === panelId || id.startsWith(`${panelId}/`);
}

/**
 * Session-scoped undo: snapshots of the live overlay taken just before each
 * mutation (prompt patch, visual selection, reset). Undo pops the latest
 * snapshot back into place; resets return one panel (or everything) to the
 * page-load look (`initialOverlay`). In-memory by design — saved visuals are
 * the durable bookmarks — and `onApplied` fires after undo/reset so hosts
 * that persist stay in sync.
 */
export function useUndoStack({
  overlay,
  setOverlay,
  onApplied,
  initialOverlay,
  clearActiveVisual,
}: Args) {
  const [history, setHistory] = useState<Overlay[]>([]);

  const push = useCallback((snapshot: Overlay) => {
    setHistory((prev) => [...prev.slice(-(MAX_DEPTH - 1)), snapshot]);
  }, []);

  const undo = useCallback(async () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1] as Overlay;
    setHistory((prev) => prev.slice(0, -1));
    setOverlay(previous);
    clearActiveVisual();
    await onApplied?.(previous);
  }, [history, setOverlay, clearActiveVisual, onApplied]);

  const resetPanel = useCallback(
    async (panelId: string) => {
      push(overlay);
      const next: Overlay = {};
      for (const [id, override] of Object.entries(overlay)) {
        if (!belongsTo(id, panelId)) next[id] = override;
      }
      for (const [id, override] of Object.entries(initialOverlay)) {
        if (belongsTo(id, panelId)) next[id] = override;
      }
      setOverlay(next);
      clearActiveVisual();
      await onApplied?.(next);
    },
    [overlay, initialOverlay, push, setOverlay, clearActiveVisual, onApplied],
  );

  const resetAll = useCallback(async () => {
    push(overlay);
    setOverlay(initialOverlay);
    clearActiveVisual();
    await onApplied?.(initialOverlay);
  }, [overlay, initialOverlay, push, setOverlay, clearActiveVisual, onApplied]);

  return { canUndo: history.length > 0, depth: history.length, push, undo, resetPanel, resetAll };
}
```

- [ ] **Step 4: Replace `packages/prompt/src/use-saved-visuals.ts`**

```ts
'use client';

import type { Overlay } from '@dotui/core';
import { useCallback, useState } from 'react';
import type { DotuiPromptProviderProps, SavedVisual } from './types';

type Args = {
  initial: SavedVisual[];
  onSaveVisual: DotuiPromptProviderProps['onSaveVisual'];
  onDeleteVisual: DotuiPromptProviderProps['onDeleteVisual'];
  onApplied: DotuiPromptProviderProps['onApplied'];
  overlay: Overlay;
  setOverlay: (overlay: Overlay) => void;
  /** Called with the CURRENT overlay just before selecting a visual replaces it (undo hook). */
  onBeforeChange: (current: Overlay) => void;
};

/**
 * The "saved visuals" concern, out of the provider's way: named whole-UI
 * snapshots of the overlay. Saving snapshots the current overlay (persisted via
 * `onSaveVisual` when the host returns a stored record, in-memory otherwise);
 * selecting one replaces the live overlay wholesale — a snapshot is absolute,
 * not a patch — and reports it via `onApplied` so the host can persist the
 * new live look. Deleting removes the bookmark only (the live overlay is
 * untouched); `onDeleteVisual` lets the host persist the removal.
 * `activeVisualId` is which snapshot the live overlay currently matches; the
 * provider clears it when a prompt diverges the look.
 */
export function useSavedVisuals({
  initial,
  onSaveVisual,
  onDeleteVisual,
  onApplied,
  overlay,
  setOverlay,
  onBeforeChange,
}: Args) {
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
      onBeforeChange(overlay);
      setOverlay(visual.overlay);
      setActiveVisualId(visual.id);
      await onApplied?.(visual.overlay);
    },
    [overlay, setOverlay, onApplied, onBeforeChange],
  );

  const deleteVisual = useCallback(
    async (visual: SavedVisual) => {
      setVisuals((prev) => prev.filter((v) => v.id !== visual.id));
      setActiveVisualId((current) => (current === visual.id ? null : current));
      await onDeleteVisual?.(visual);
    },
    [onDeleteVisual],
  );

  const clearActiveVisual = useCallback(() => setActiveVisualId(null), []);

  return { visuals, activeVisualId, saveVisual, selectVisual, deleteVisual, clearActiveVisual };
}
```

- [ ] **Step 5: Extend `packages/prompt/src/types.ts`**

Add after the `onSaveVisual` prop in `DotuiPromptProviderProps`:

```ts
  /**
   * Persist the removal of a saved visual (e.g. DELETE to a store-backed endpoint).
   * Omit to keep deletion in-memory only. The live overlay is never touched by a delete.
   */
  onDeleteVisual?: (visual: SavedVisual) => void | Promise<void>;
```

And in `PromptContextValue`, after `runPanel`:

```ts
  /** Return one panel (its id + all descendant ids) to the page-load look. */
  resetPanel: (panelId: string) => void;
```

- [ ] **Step 6: Replace `packages/prompt/src/provider.tsx` (FINAL version)**

```tsx
'use client';

import type { Overlay } from '@dotui/core';
import { mergeOverlay } from '@dotui/core';
import { DotOverlayProvider } from '@dotui/elements';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PromptContext } from './context';
import { Control } from './control';
import { PROMPT_STYLES } from './styles';
import { Toasts } from './toasts';
import type { DotuiPromptProviderProps } from './types';
import { useSavedVisuals } from './use-saved-visuals';
import { useToasts } from './use-toasts';
import { useUndoStack } from './use-undo-stack';

/** One human-readable line for the classes the guardrail refused, or null if none. */
export function droppedSummary(dropped: Record<string, string[]> | undefined): string | null {
  const classes = [...new Set(Object.values(dropped ?? {}).flat())];
  if (classes.length === 0) return null;
  const shown = classes.slice(0, 5).join(', ');
  return `Skipped disallowed styles: ${shown}${classes.length > 5 ? ', …' : ''}`;
}

/**
 * Wraps an app in the prompt layer: holds the live overlay, renders a
 * DotOverlayProvider so every dot picks it up, and shows the floating ✨ control.
 * End-users prompt one panel (via `<Promptable>`) or all panels (global box),
 * undo or reset what they did, and manage saved visuals. Failures and guardrail
 * drops surface as toasts. Everything here is apply-only: persistence flows
 * through the host's onApplied / onSaveVisual / onDeleteVisual callbacks.
 */
export function DotuiPromptProvider({
  generate,
  initialOverlay = {},
  onApplied,
  savedVisuals = [],
  onSaveVisual,
  onDeleteVisual,
  children,
}: DotuiPromptProviderProps) {
  const [overlay, setOverlay] = useState<Overlay>(initialOverlay);
  const [editMode, setEditMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Panels register themselves (top-down, in render order) so a global prompt
  // knows what to iterate.
  const registered = useRef<Set<string>>(new Set());
  const cancelRequested = useRef(false);
  // useSavedVisuals needs the undo push, and useUndoStack needs clearActiveVisual
  // from useSavedVisuals — a ref breaks the circular dependency.
  const pushRef = useRef<(snapshot: Overlay) => void>(() => {});

  const { toasts, addToast, dismiss } = useToasts();

  const { visuals, activeVisualId, saveVisual, selectVisual, deleteVisual, clearActiveVisual } =
    useSavedVisuals({
      initial: savedVisuals,
      onSaveVisual,
      onDeleteVisual,
      onApplied,
      overlay,
      setOverlay,
      onBeforeChange: (current) => pushRef.current(current),
    });

  const { canUndo, depth, push, undo, resetPanel, resetAll } = useUndoStack({
    overlay,
    setOverlay,
    onApplied,
    initialOverlay,
    clearActiveVisual,
  });
  pushRef.current = push;

  const runPanel = useCallback(
    async (panelId: string, prompt: string) => {
      if (!prompt.trim()) return;
      setBusy(true);
      setActivePanelId(panelId);
      try {
        const result = await generate({ prompt, panelId, current: overlay });
        push(overlay); // snapshot only once we have something to apply
        const next = mergeOverlay(overlay, result.overlay);
        setOverlay(next);
        clearActiveVisual(); // the look no longer matches any saved snapshot
        const summary = droppedSummary(result.dropped);
        if (summary) addToast('info', summary);
        await onApplied?.(next);
      } catch {
        addToast('error', 'Could not restyle this panel — try again.');
      } finally {
        setBusy(false);
        setActivePanelId(null);
      }
    },
    [generate, overlay, onApplied, clearActiveVisual, push, addToast],
  );

  const runGlobal = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      const ids = [...registered.current];
      if (ids.length === 0) return;
      setBusy(true);
      cancelRequested.current = false;
      setProgress({ done: 0, total: ids.length });
      const droppedAll = new Set<string>();
      let pushed = false;
      try {
        // One panel at a time, in registration (top-down) order. Each call gets the
        // overlay accumulated so far as `current`, so a later panel can match the
        // styling already chosen for earlier ones. We apply after every panel so the
        // screen repaints panel-by-panel; Stop lets the in-flight panel finish, then
        // ends the run (applied panels stay applied).
        let acc = overlay;
        let done = 0;
        for (const id of ids) {
          if (cancelRequested.current) {
            addToast('info', `Stopped after ${done} of ${ids.length} panels.`);
            break;
          }
          setActivePanelId(id);
          const result = await generate({ prompt, panelId: id, current: acc });
          if (!pushed) {
            push(overlay); // one undo step per global run
            pushed = true;
          }
          acc = mergeOverlay(acc, result.overlay);
          setOverlay(acc);
          done += 1;
          setProgress({ done, total: ids.length });
          for (const classes of Object.values(result.dropped ?? {})) {
            for (const cls of classes) droppedAll.add(cls);
          }
        }
        clearActiveVisual();
        const summary = droppedSummary(droppedAll.size ? { run: [...droppedAll] } : undefined);
        if (summary) addToast('info', summary);
        await onApplied?.(acc);
      } catch {
        addToast('error', 'Could not finish the global restyle — try again.');
      } finally {
        setBusy(false);
        setActivePanelId(null);
        setProgress(null);
        cancelRequested.current = false;
      }
    },
    [generate, overlay, onApplied, clearActiveVisual, push, addToast],
  );

  const cancelGlobal = useCallback(() => {
    cancelRequested.current = true;
  }, []);

  const register = useCallback((id: string) => {
    registered.current.add(id);
  }, []);
  const unregister = useCallback((id: string) => {
    registered.current.delete(id);
  }, []);

  const ctx = useMemo(
    () => ({ editMode, busy, activePanelId, runPanel, resetPanel, register, unregister }),
    [editMode, busy, activePanelId, runPanel, resetPanel, register, unregister],
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
        progress={progress}
        onCancel={cancelGlobal}
        canUndo={canUndo}
        undoDepth={depth}
        onUndo={undo}
        onResetAll={resetAll}
        visuals={visuals}
        activeVisualId={activeVisualId}
        onSaveVisual={saveVisual}
        onSelectVisual={selectVisual}
        onDeleteVisual={deleteVisual}
      />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </PromptContext.Provider>
  );
}
```

- [ ] **Step 7: Replace `packages/prompt/src/control.tsx` (FINAL version)**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { SavedVisual } from './types';

/**
 * The floating edit-mode control (bottom-left). Collapsed it's a "✨ Edit UI"
 * pill; open it shows the global prompt box (with run progress + Stop), undo /
 * reset-all, and the saved-visuals switcher (save, switch, delete with an
 * arm-then-confirm ✕). Escape closes it and focus returns to the pill.
 */
export function Control({
  editMode,
  busy,
  onToggle,
  onGlobal,
  progress,
  onCancel,
  canUndo,
  undoDepth,
  onUndo,
  onResetAll,
  visuals,
  activeVisualId,
  onSaveVisual,
  onSelectVisual,
  onDeleteVisual,
}: {
  editMode: boolean;
  busy: boolean;
  onToggle: () => void;
  onGlobal: (prompt: string) => void;
  progress: { done: number; total: number } | null;
  onCancel: () => void;
  canUndo: boolean;
  undoDepth: number;
  onUndo: () => void;
  onResetAll: () => void;
  visuals: SavedVisual[];
  activeVisualId: string | number | null;
  onSaveVisual: (name: string) => void;
  onSelectVisual: (visual: SavedVisual) => void;
  onDeleteVisual: (visual: SavedVisual) => void;
}) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [armedId, setArmedId] = useState<string | number | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // When the panel closes (Escape or ✕), give focus back to the pill — but not
  // on initial mount, when nothing was ever open.
  useEffect(() => {
    if (editMode) wasOpen.current = true;
    else if (wasOpen.current) pillRef.current?.focus();
  }, [editMode]);

  const handleDelete = (visual: SavedVisual) => {
    if (armTimer.current) clearTimeout(armTimer.current);
    if (armedId === visual.id) {
      setArmedId(null);
      onDeleteVisual(visual);
    } else {
      setArmedId(visual.id);
      armTimer.current = setTimeout(() => setArmedId(null), 3000);
    }
  };

  if (!editMode) {
    return (
      <button
        ref={pillRef}
        type="button"
        onClick={onToggle}
        aria-label="Open the dotUI edit panel"
        className="fixed bottom-4 left-4 z-50 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-violet-500"
      >
        ✨ Edit UI
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-50 w-80 rounded-lg border border-violet-300 bg-white p-3 shadow-2xl"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onToggle();
      }}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
        <span>✨ Edit UI — global</span>
        {busy && !progress && <span className="text-violet-600">working…</span>}
        <button
          type="button"
          onClick={onUndo}
          disabled={busy || !canUndo}
          aria-label={`Undo last change (${undoDepth} available)`}
          className="ml-auto rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-violet-400 disabled:opacity-40"
        >
          ↩ Undo{canUndo ? ` (${undoDepth})` : ''}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Close the edit panel"
          className="text-slate-400 hover:text-slate-700"
        >
          ✕
        </button>
      </div>

      {progress && (
        <div className="mb-2 flex items-center gap-2 text-xs text-violet-700">
          <span>
            Styling panel {Math.min(progress.done + 1, progress.total)} of {progress.total}…
          </span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Stop the global restyle after the current panel"
            className="ml-auto rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-white"
          >
            ■ Stop
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onGlobal(text);
          setText('');
        }}
        className="flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          placeholder="e.g. make everything bigger and calmer"
          aria-label="Global restyle prompt"
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Apply
        </button>
      </form>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[10px] text-slate-400">
          Applies to every panel. Use a panel's own ✨ to restyle just that one.
        </p>
        <button
          type="button"
          onClick={onResetAll}
          disabled={busy}
          aria-label="Reset all styling to the page-load look"
          className="shrink-0 text-[10px] font-medium text-slate-500 underline hover:text-violet-600 disabled:opacity-40"
        >
          ⟲ Reset all
        </button>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="mb-2 text-xs font-semibold text-slate-700">💾 Saved visuals</div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveVisual(name);
            setName('');
          }}
          className="flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder="name this look…"
            aria-label="Name for the saved visual"
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
        </form>

        {visuals.length === 0 ? (
          <p className="mt-2 text-[10px] text-slate-400">
            No saved visuals yet. Style the UI, then save it to switch back anytime.
          </p>
        ) : (
          <div
            role="group"
            aria-label="Saved visuals"
            className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto"
          >
            {visuals.map((v) => {
              const isActive = v.id === activeVisualId;
              const isArmed = v.id === armedId;
              return (
                <span
                  key={v.id}
                  className={`inline-flex items-center overflow-hidden rounded-full border text-[11px] font-medium ${
                    isActive
                      ? 'border-violet-500 bg-violet-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSelectVisual(v)}
                    title={`Switch to “${v.name}”`}
                    className={`px-2.5 py-1 disabled:opacity-50 ${
                      isActive ? '' : 'hover:bg-violet-50'
                    }`}
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(v)}
                    aria-label={isArmed ? `Confirm delete ${v.name}` : `Delete visual ${v.name}`}
                    className={`border-l px-1.5 py-1 disabled:opacity-50 ${
                      isArmed
                        ? 'border-red-300 bg-red-600 text-white'
                        : isActive
                          ? 'border-violet-400 hover:bg-violet-500'
                          : 'border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600'
                    }`}
                  >
                    {isArmed ? 'sure?' : '✕'}
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Replace `packages/prompt/src/promptable.tsx` (FINAL version)**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrompt } from './context';
import type { PromptableProps } from './types';

/**
 * Wraps one panel so it becomes individually promptable. Renders the panel
 * untouched; in edit mode it overlays a small ✨ button in the corner that opens
 * an inline prompt box (with a ⟲ reset for just this panel). Escape closes the
 * box and focus returns to the ✨ opener. Registers its panelId so the global
 * box can target it too.
 */
export function Promptable({ panelId, children, className, showControl = true }: PromptableProps) {
  const { editMode, busy, activePanelId, runPanel, resetPanel, register, unregister } = usePrompt();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const openerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    register(panelId);
    return () => unregister(panelId);
  }, [panelId, register, unregister]);

  // Return focus to the ✨ opener when the popover closes (Escape or submit).
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) openerRef.current?.focus();
  }, [open]);

  const active = activePanelId === panelId;

  return (
    <div className={`relative ${active ? 'dotui-panel-active' : ''} ${className ?? ''}`}>
      {active && (
        <span className="dotui-active-badge" aria-hidden="true">
          ✨ styling…
        </span>
      )}
      {children}
      {editMode && showControl && (
        <div className="absolute right-1 top-1 z-40">
          {open ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runPanel(panelId, text);
                setText('');
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
              }}
              className="flex gap-1 rounded-md border border-violet-300 bg-white/95 p-1 shadow"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={busy}
                placeholder="restyle this panel…"
                aria-label={`Prompt for ${panelId}`}
                className="w-44 rounded border border-slate-300 px-1 text-[11px] disabled:opacity-50"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  resetPanel(panelId);
                  setOpen(false);
                }}
                aria-label={`Reset ${panelId} to its original look`}
                title="Reset this panel"
                className="rounded border border-slate-300 px-1.5 text-[11px] text-slate-600 hover:border-violet-400 disabled:opacity-50"
              >
                ⟲
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-violet-600 px-1.5 text-[11px] text-white disabled:opacity-50"
              >
                ↵
              </button>
            </form>
          ) : (
            <button
              ref={openerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Restyle ${panelId} by prompt`}
              title="Prompt this panel"
              className="rounded-full bg-violet-600/90 px-1.5 py-0.5 text-[11px] text-white shadow hover:bg-violet-500"
            >
              ✨
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Run all prompt tests**

Run: `corepack pnpm --filter "@dotui/prompt" run test`
Expected: **12 pass** (5 original + 7 in polish.test.tsx). The original tests exercise the same components — if any of them fails, the rewrite changed baseline behavior: fix the component, not the test.

- [ ] **Step 10: Package gate + commit**

Run: `corepack pnpm --filter "@dotui/prompt" run build`, `… run typecheck`, `corepack pnpm exec biome check packages/prompt`
Expected: green.

```bash
git add packages/prompt
git commit -m "feat(prompt): undo/reset, global-run progress + stop, visual delete, a11y

Session undo stack (25 deep) with per-panel and whole-UI reset to the
page-load look; global runs show n-of-m progress and can be stopped after
the in-flight panel; saved visuals get an arm-then-confirm delete backed by
the new onDeleteVisual host callback; injected chrome gains aria-labels,
Escape-to-close with focus return, and a polite live region.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Apps — per-user overlay scoping (×3), gmail DELETE route + wiring, watch a11y

**Files:**
- Create: `apps/gmail/middleware.ts`, `apps/demo/middleware.ts`, `apps/youtube/middleware.ts` (identical content)
- Create: `apps/gmail/lib/scope.ts`, `apps/demo/lib/scope.ts`, `apps/youtube/lib/scope.ts` (identical content)
- Modify: `apps/gmail/app/api/overlay/route.ts`, `apps/demo/app/api/overlay/route.ts`, `apps/youtube/app/api/overlay/route.ts` (identical replacement)
- Modify: `apps/gmail/app/api/visuals/route.ts` (scope + DELETE)
- Modify: `apps/gmail/app/layout.tsx` (scoped reads)
- Modify: `apps/youtube/app/layout.tsx` (scoped read)
- Modify: `apps/demo/app/page.tsx` (scoped read: the `overlayStore.current('default')` line)
- Modify: `apps/gmail/app/shell.tsx` (add `deleteVisual` bridge + `onDeleteVisual` prop)
- Modify: `apps/youtube/app/watch.panel.tsx` (keyboard access on the up-next template row)

**Interfaces:**
- Consumes: Task 2's `onDeleteVisual?: (visual: SavedVisual) => void | Promise<void>` provider prop; `@dotui/store`'s existing `scope` parameters (`current(scope)`, `list(scope)`, `save({ …, scope })`, `listVisuals(scope)`, `saveVisual({ …, scope })`, `deleteVisual(id)`).
- Produces: `overlayScope(): Promise<string>` per app; the `dotui_uid` cookie contract.

- [ ] **Step 1: Create the middleware (same content in all three apps)**

`apps/gmail/middleware.ts`, `apps/demo/middleware.ts`, `apps/youtube/middleware.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Every visitor gets a stable anonymous id (`dotui_uid`) on first contact; the
 * overlay/visual stores key their rows by it, so one person's ✨ edits are
 * theirs alone instead of becoming everyone's UI.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get('dotui_uid')) {
    response.cookies.set('dotui_uid', crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  return response;
}
```

- [ ] **Step 2: Create the scope helper (same content in all three apps)**

`apps/gmail/lib/scope.ts`, `apps/demo/lib/scope.ts`, `apps/youtube/lib/scope.ts`:

```ts
import { cookies } from 'next/headers';

/**
 * The per-visitor overlay scope: the anonymous `dotui_uid` cookie set by
 * middleware. Falls back to 'default' if it is somehow absent (middleware runs
 * before any page or route, so this is belt-and-braces).
 */
export async function overlayScope(): Promise<string> {
  const store = await cookies();
  return store.get('dotui_uid')?.value ?? 'default';
}
```

- [ ] **Step 3: Replace the overlay route (same content in all three apps)**

`apps/gmail/app/api/overlay/route.ts`, `apps/demo/app/api/overlay/route.ts`, `apps/youtube/app/api/overlay/route.ts`:

```ts
import type { Overlay } from '@dotui/elements';
import { NextResponse } from 'next/server';
import schema from '../../../.dotui/schema.json';
import { overlayScope } from '../../../lib/scope';
import { overlayStore } from '../../../lib/store';

export const dynamic = 'force-dynamic';

type SaveBody = { panelId?: string; overlay?: Overlay; prompt?: string };

export async function GET() {
  const scope = await overlayScope();
  const [current, records] = await Promise.all([
    overlayStore.current(scope),
    overlayStore.list(scope),
  ]);
  return NextResponse.json({ current, records });
}

export async function POST(request: Request) {
  const body = (await request.json()) as SaveBody;
  if (!body.panelId || !body.overlay) {
    return NextResponse.json({ error: 'panelId and overlay are required.' }, { status: 400 });
  }
  const scope = await overlayScope();
  await overlayStore.save({
    panelId: body.panelId,
    overlay: body.overlay,
    prompt: body.prompt,
    appSchemaVersion: schema.version,
    scope,
  });
  return NextResponse.json({ current: await overlayStore.current(scope) });
}
```

- [ ] **Step 4: Replace `apps/gmail/app/api/visuals/route.ts` (scope + DELETE)**

```ts
import type { Overlay } from '@dotui/elements';
import { NextResponse } from 'next/server';
import { overlayScope } from '../../../lib/scope';
import { overlayStore } from '../../../lib/store';

export const dynamic = 'force-dynamic';

type SaveBody = { name?: string; overlay?: Overlay };

// List this visitor's saved visuals (named whole-UI snapshots).
export async function GET() {
  const visuals = await overlayStore.listVisuals(await overlayScope());
  return NextResponse.json({ visuals });
}

// Save the current look as a named visual and return the stored record (with its real id).
export async function POST(request: Request) {
  const body = (await request.json()) as SaveBody;
  const name = body.name?.trim();
  if (!name || !body.overlay) {
    return NextResponse.json({ error: 'name and overlay are required.' }, { status: 400 });
  }
  const scope = await overlayScope();
  const visual = await overlayStore.saveVisual({ name, overlay: body.overlay, scope });
  return NextResponse.json({ visual });
}

// Delete one of this visitor's visuals. The scope check stops cross-user deletes.
export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'id must be an integer.' }, { status: 400 });
  }
  const scope = await overlayScope();
  const visuals = await overlayStore.listVisuals(scope);
  if (!visuals.some((v) => v.id === id)) {
    return NextResponse.json({ error: 'No such visual in your scope.' }, { status: 404 });
  }
  await overlayStore.deleteVisual(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Scope the server reads**

`apps/gmail/app/layout.tsx` — add `import { overlayScope } from '../lib/scope';` and replace the two reads:

```ts
  await overlayStore.saveSchema(schema);
  const scope = await overlayScope();
  const [initialOverlay, initialVisuals] = await Promise.all([
    overlayStore.current(scope),
    overlayStore.listVisuals(scope),
  ]);
```

`apps/youtube/app/layout.tsx` — add the same import and replace
`const initialOverlay = await overlayStore.current('default');` with:

```ts
  const initialOverlay = await overlayStore.current(await overlayScope());
```

`apps/demo/app/page.tsx` — add the same import (path `../lib/scope`) and replace
`const initialOverlay = await overlayStore.current('default');` with:

```ts
  const initialOverlay = await overlayStore.current(await overlayScope());
```

- [ ] **Step 6: Wire visual deletion in `apps/gmail/app/shell.tsx`**

Add after the `saveVisual` const:

```ts
/** Persist the removal of a saved visual; the switcher already removed it locally. */
const deleteVisual = async (visual: SavedVisual) => {
  const response = await fetch(`/api/visuals?id=${visual.id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await response.text());
};
```

and add `onDeleteVisual={deleteVisual}` to the `<DotuiPromptProvider …>` props (after `onSaveVisual={saveVisual}`).

- [ ] **Step 7: Keyboard access for the watch up-next row**

In `apps/youtube/app/watch.panel.tsx`, the up-next template `dot.panel` gains
`role`, `tabIndex`, and `onKeyDown` (recorded a11y follow-up from the
repeated-dots review — the row became a div and lost keyboard activation):

```tsx
        {upNext.map((v) => (
          <dot.panel
            key={v.id}
            description="Up-next video row (template — one per suggestion)."
            role="button"
            tabIndex={0}
            onClick={() => onSelect(v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(v);
              }
            }}
            className="flex cursor-pointer items-center gap-3 rounded-lg p-1 text-left hover:bg-slate-100"
          >
```

(the `dot.image`/`dot.text` children and the rest of the block stay exactly as they are).

- [ ] **Step 8: Build all three apps**

Run: `corepack pnpm --filter "@dotui/gmail" run build`, `corepack pnpm --filter "@dotui/demo" run build`, `corepack pnpm --filter "@dotui/youtube" run build`
Expected: all compile (middleware appears in the build output as `ƒ Middleware`).
Then `corepack pnpm exec biome check apps` → clean.

- [ ] **Step 9: Two-cookie-jar isolation smoke (gmail)**

```bash
cd apps/gmail && corepack pnpm exec next start -p 3102 &
sleep 5
JAR_A="$TEMP/dotui-jarA.txt"; JAR_B="$TEMP/dotui-jarB.txt"; rm -f "$JAR_A" "$JAR_B"
curl -s -c "$JAR_A" http://localhost:3102/api/overlay > /dev/null   # jar A gets a uid
curl -s -b "$JAR_A" -c "$JAR_A" -X POST http://localhost:3102/api/overlay \
  -H "Content-Type: application/json" \
  -d '{"panelId":"app","overlay":{"probe/panel#0":{"className":"bg-red-500"}}}'
curl -s -b "$JAR_A" http://localhost:3102/api/overlay   # expect current to contain probe/panel#0
curl -s -c "$JAR_B" http://localhost:3102/api/overlay   # fresh jar B: expect current == {}
```

Expected: jar A's GET shows the probe overlay; jar B's GET shows `"current":{}`. Kill the server afterwards. If `next start` can't run in this environment, report the smoke as not-run in your report and rely on the route unit logic + build.

- [ ] **Step 10: Commit**

```bash
git add apps
git commit -m "feat(apps): per-user overlays via anonymous dotui_uid cookie + gmail visual delete

All three apps scope overlay/visual reads and writes to a per-browser cookie
so one visitor's edits stop being everyone's UI; gmail gains DELETE
/api/visuals wired to the new onDeleteVisual; the watch up-next template row
is keyboard-activatable again (role=button, tabIndex, Enter/Space).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Docs + full gate

**Files:**
- Modify: `packages/prompt/README.md` (document undo/toasts/progress/delete + `onDeleteVisual`)
- Modify: `PROGRESS.md` (new status section)

**Interfaces:** none — documentation and the final verification gate.

- [ ] **Step 1: Update `packages/prompt/README.md`**

In the `DotuiPromptProvider` bullet list, after the `savedVisuals` / `onSaveVisual` line, add:

```markdown
  - `onDeleteVisual(visual)` — persist the removal of a saved visual (e.g.
    DELETE to a store-backed endpoint); omit for in-memory-only deletion.
```

And after the `Promptable` bullet, add a new bullet:

```markdown
- **Built-in UX:** a session undo stack (↩ Undo, per-panel ⟲ reset, ⟲ Reset
  all — all return to the page-load `initialOverlay` and fire `onApplied`),
  toast notifications for generation failures and guardrail-dropped classes,
  n-of-m progress with a Stop button during global runs, and keyboard/screen-
  reader support (aria-labels, Escape-to-close with focus return, polite live
  region). All chrome CSS is namespaced and injected — no Tailwind safelist
  needed for it.
```

- [ ] **Step 2: Add the PROGRESS.md status section**

Insert before `### ⬜ Remaining / follow-ups`:

```markdown
### ✅ Prompt-layer polish + per-user overlays (2026-07-07, verified)
- **Undo/reset:** session undo stack in `@dotui/prompt` (25 deep; one step per
  prompt run / visual switch / reset), per-panel ⟲ reset and global "Reset all"
  back to the page-load `initialOverlay`; `onApplied` fires after undo/reset so
  persisting hosts stay in sync. In-memory by design — saved visuals stay the
  durable bookmarks.
- **Feedback:** generation failures and guardrail-dropped classes now surface
  as toasts (namespaced CSS, `aria-live` polite) instead of vanishing; global
  runs show "Styling panel n of m…" with a Stop button (finishes the in-flight
  panel, keeps what was applied); all prompt inputs disabled while busy.
- **Saved visuals:** arm-then-confirm ✕ delete on each chip; new optional
  `onDeleteVisual` provider prop; gmail wires `DELETE /api/visuals?id=` to the
  store's existing `deleteVisual`.
- **Per-user overlays (bug fix):** all three apps persisted every overlay under
  the literal scope `'default'`, so one browser's ✨ edits became every
  visitor's UI. Now `middleware.ts` issues an anonymous `dotui_uid` cookie and
  layouts/routes read+write with it as the store scope (`lib/scope.ts`). Old
  `'default'` rows simply stop being served; schema snapshots stay global.
- **A11y:** aria-labels across the injected chrome, Escape closes the edit
  panel/popovers with focus return, and the watch up-next template row is
  keyboard-activatable again (`role="button"`/`tabIndex`/Enter/Space) — closing
  the follow-up recorded by the repeated-dots review.
- **Verified:** 83 tests pass (prompt 5 → 12; others unchanged); all packages
  build + typecheck; lint clean; gmail/demo/youtube `next build` compile with
  middleware; two-cookie-jar smoke on gmail proves scope isolation.
```

(If your measured gate numbers differ, write the measured ones and flag the discrepancy in your report.)

- [ ] **Step 3: Full gate**

```bash
corepack pnpm run build
corepack pnpm run test        # expect 83: core 9, compiler 21, elements 13, guardrail 4, devtools 3, store 9, llm 12, prompt 12
corepack pnpm run typecheck
corepack pnpm run lint        # exit 0
```

- [ ] **Step 4: Commit**

```bash
git add packages/prompt/README.md PROGRESS.md
git commit -m "docs: prompt polish + per-user overlays — usability notes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-review notes (already applied)

- **Spec coverage:** §1 undo/reset → Task 2; §2 toasts → Task 1; §3 progress/cancel/busy → Task 2; §4 delete → Tasks 2+3; §5 a11y → Tasks 2 (chrome) + 3 (watch row); §6 per-user scoping (3 apps, amended) → Task 3; §7 tests → Tasks 1–3 (7 new prompt tests + build/smoke).
- **Type consistency:** `useUndoStack` args/returns match the provider's use; `useSavedVisuals`'s new `onBeforeChange`/`onDeleteVisual`/`deleteVisual` match provider + Control props; `PromptContextValue.resetPanel` matches Promptable's use; `overlayScope(): Promise<string>` matches all call sites (`await`ed); Control's full prop list matches the provider's `<Control …>` exactly.
- **Known risks for implementers:** (1) the 5 original prompt tests are the baseline contract — the Control/Promptable rewrites keep every text/placeholder/title they query (`✨ Edit UI`, `Apply`, `make everything…`, `restyle this panel…`, `↵`, `Prompt this panel`); (2) the provider's `pushRef` pattern exists to break the useSavedVisuals ↔ useUndoStack circular dependency — don't "simplify" it into a direct reference; (3) Next 15's `cookies()` is async — every `overlayScope()` call must be awaited; (4) the smoke test needs `next start` — if the port is taken use another, and always kill the server.
