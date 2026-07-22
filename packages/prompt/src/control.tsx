'use client';

import { useEffect, useRef, useState } from 'react';
import type { SavedVisual } from './types';

/**
 * The floating edit-mode control (bottom-left). Collapsed it's a " Edit UI"
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

  // Clear a pending disarm timer if the control unmounts mid-arm.
  useEffect(() => {
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, []);

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
         Edit UI
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
        <span> Edit UI — global</span>
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
        <output aria-live="polite" className="mb-2 flex items-center gap-2 text-xs text-violet-700">
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
        </output>
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
          Applies to every panel. Use a panel's own  to restyle just that one.
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
          <fieldset
            aria-label="Saved visuals"
            className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto border-0 p-0"
          >
            <legend className="sr-only">Saved visuals</legend>
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
          </fieldset>
        )}
      </div>
    </div>
  );
}
