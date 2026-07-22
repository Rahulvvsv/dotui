'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrompt } from './context';
import type { PromptableProps } from './types';

/**
 * Wraps one panel so it becomes individually promptable. Renders the panel
 * untouched; in edit mode it overlays a small  button in the corner that opens
 * an inline prompt box (with a ⟲ reset for just this panel). Escape closes the
 * box and focus returns to the  opener. Registers its panelId so the global
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

  // Return focus to the  opener when the popover closes (Escape or submit).
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) openerRef.current?.focus();
  }, [open]);

  const active = activePanelId === panelId;

  return (
    <div className={`relative ${active ? 'dotui-panel-active' : ''} ${className ?? ''}`}>
      {active && (
        <span className="dotui-active-badge" aria-hidden="true">
           styling…
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
              
            </button>
          )}
        </div>
      )}
    </div>
  );
}
