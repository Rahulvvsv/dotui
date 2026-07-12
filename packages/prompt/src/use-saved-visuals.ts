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
