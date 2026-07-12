'use client';

import type { Overlay } from '@dotui/core';
import { mergeOverlay } from '@dotui/core';
import { DotOverlayProvider } from '@dotui/elements';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PromptContext } from './context';
import { Control } from './control';
import { PROMPT_STYLES } from './styles';
import { Toasts } from './toasts';
import type { DotuiPromptProviderProps, SavedVisual } from './types';
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

  // undo / resetPanel / resetAll / deleteVisual all await a host callback
  // (onApplied / onDeleteVisual) that can reject — e.g. gmail's bridges throw on
  // a non-ok response. Called fire-and-forget from onClick, an unhandled
  // rejection would otherwise leave the user with no feedback at all: the local
  // change already applied, but the host-side persist silently failed. These
  // wrappers are the only copies reachable from the UI.
  const handleUndo = useCallback(async () => {
    try {
      await undo();
    } catch {
      addToast('error', 'Undo applied locally, but saving it failed.');
    }
  }, [undo, addToast]);

  const handleResetPanel = useCallback(
    async (panelId: string) => {
      try {
        await resetPanel(panelId);
      } catch {
        addToast('error', 'Reset applied locally, but saving it failed.');
      }
    },
    [resetPanel, addToast],
  );

  const handleResetAll = useCallback(async () => {
    try {
      await resetAll();
    } catch {
      addToast('error', 'Reset applied locally, but saving it failed.');
    }
  }, [resetAll, addToast]);

  const handleDeleteVisual = useCallback(
    async (visual: SavedVisual) => {
      try {
        await deleteVisual(visual);
      } catch {
        addToast(
          'error',
          'Could not delete that visual on the server — it may reappear on reload.',
        );
      }
    },
    [deleteVisual, addToast],
  );

  const ctx = useMemo(
    () => ({
      editMode,
      busy,
      activePanelId,
      runPanel,
      resetPanel: handleResetPanel,
      register,
      unregister,
    }),
    [editMode, busy, activePanelId, runPanel, handleResetPanel, register, unregister],
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
        onUndo={handleUndo}
        onResetAll={handleResetAll}
        visuals={visuals}
        activeVisualId={activeVisualId}
        onSaveVisual={saveVisual}
        onSelectVisual={selectVisual}
        onDeleteVisual={handleDeleteVisual}
      />
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </PromptContext.Provider>
  );
}
