'use client';

import { DotuiDevtools } from '@dotui/devtools';
import type { Overlay } from '@dotui/elements';
import { DotuiPromptProvider, type GenerateFn, Promptable, type SavedVisual } from '@dotui/prompt';
import type { ReactNode } from 'react';
import { schema } from '../lib/schema';
import { Frame } from './frame.panel';
import { Sidebar } from './sidebar.panel';
import { Topbar } from './topbar.panel';

/**
 * Bridge to the generation pipeline: POST to the server-only route, which picks OpenAI
 * (when OPENAI_API_KEY is set) or the mock fallback, then guardrails the result.
 */
const generate: GenerateFn = async ({ prompt, panelId, current }) => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, panelId, current }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};

/**
 * Persist the live look so a reload restores it. The whole overlay is saved as a single
 * row (panelId `app`); the layout reads it back via `overlayStore.current` on the next
 * request. The browser only ever sends the overlay JSON — the database stays server-side.
 */
const persist = async (overlay: Overlay) => {
  await fetch('/api/overlay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ panelId: 'app', overlay }),
  });
};

/**
 * Save the current look as a named visual and return the stored record (with its real DB
 * id) so the switcher can highlight and round-trip it.
 */
const saveVisual = async (visual: { name: string; overlay: Overlay }): Promise<SavedVisual> => {
  const response = await fetch('/api/visuals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(visual),
  });
  if (!response.ok) throw new Error(await response.text());
  const { visual: saved } = (await response.json()) as { visual: SavedVisual };
  return saved;
};

/** Persist the removal of a saved visual; the switcher already removed it locally. */
const deleteVisual = async (visual: SavedVisual) => {
  const response = await fetch(`/api/visuals?id=${visual.id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await response.text());
};

/**
 * The shared app chrome, authored entirely in dotUI: the base `Frame` (top bar over a body
 * row with the sidebar) wraps the routed page (`children` — the inbox or the read view).
 * Living in the layout, the prompt provider stays mounted across navigation, so the overlay
 * is continuous as you move between `/` and `/read`, and `onApplied` persists it to the DB.
 *
 * The base panel is a no-control `<Promptable>` so a global prompt (e.g. "dark mode")
 * restyles the background too — otherwise it stays bg-slate-50 and shows through.
 */
export function Shell({
  initialOverlay,
  initialVisuals,
  children,
}: {
  initialOverlay: Overlay;
  initialVisuals: SavedVisual[];
  children: ReactNode;
}) {
  return (
    <DotuiPromptProvider
      generate={generate}
      initialOverlay={initialOverlay}
      onApplied={persist}
      savedVisuals={initialVisuals}
      onSaveVisual={saveVisual}
      onDeleteVisual={deleteVisual}
    >
      <Promptable panelId="frame/panel#0" showControl={false}>
        <Frame
          topbar={
            <Promptable panelId="topbar/panel#0">
              <Topbar />
            </Promptable>
          }
          body={
            <>
              <Promptable panelId="sidebar/panel#0">
                <Sidebar />
              </Promptable>
              {children}
            </>
          }
        />
      </Promptable>

      <DotuiDevtools schema={schema} endpoint="/api/overlay" />
    </DotuiPromptProvider>
  );
}
