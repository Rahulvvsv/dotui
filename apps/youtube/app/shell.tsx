'use client';

import { DotuiDevtools } from '@dotui/devtools';
import type { Overlay } from '@dotui/elements';
import { DotuiPromptProvider, type GenerateFn, Promptable } from '@dotui/prompt';
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
 * The shared app chrome, authored entirely in dotUI: the base `Frame` (top bar over a body
 * row with the sidebar) wraps the routed page (`children` — the feed or the watch page).
 * Living in the layout, the prompt provider stays mounted across navigation, so the overlay
 * is continuous as you move between `/` and `/watch`, and `onApplied` persists it to the DB.
 *
 * The base panel is a no-control `<Promptable>` so a global prompt (e.g. "dark mode")
 * restyles the background too — otherwise it stays bg-white and shows through.
 */
export function Shell({
  initialOverlay,
  children,
}: {
  initialOverlay: Overlay;
  children: ReactNode;
}) {
  return (
    <DotuiPromptProvider generate={generate} initialOverlay={initialOverlay} onApplied={persist}>
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
