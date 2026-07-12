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
