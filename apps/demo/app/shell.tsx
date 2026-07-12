'use client';

import { DotuiDevtools } from '@dotui/devtools';
import type { Overlay } from '@dotui/elements';
import type { GenerateResult } from '@dotui/llm';
import { DotuiPromptProvider, Promptable } from '@dotui/prompt';
import type { GenerateFn } from '@dotui/prompt';
import { schema } from '../lib/schema';
import { Profile } from './profile.panel';
import { Settings } from './settings.panel';

const generate: GenerateFn = async ({ prompt, panelId, current }) => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, panelId, current }),
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as GenerateResult;
};

export function Shell({ initialOverlay }: { initialOverlay: Overlay }) {
  return (
    <DotuiPromptProvider generate={generate} initialOverlay={initialOverlay}>
      <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-slate-900">dotUI v2 — prompt the UI</h1>
          <p className="text-sm text-slate-500">
            Hit <span className="font-semibold text-violet-600">✨ Edit UI</span> (bottom-left),
            then prompt a single panel or all of them — e.g. “make it bigger”, “dark mode”, “hide
            the status”. Changes apply live; nothing is saved.
          </p>
        </header>

        <Promptable panelId="profile/panel#0">
          {/* biome-ignore lint/a11y/useValidAriaRole: `role` is a Profile domain prop (job title), not an ARIA role. */}
          <Profile
            name="Ada Lovelace"
            role="Principal Engineer"
            avatarUrl="https://i.pravatar.cc/128?img=5"
            online
          />
        </Promptable>

        <Promptable panelId="settings/panel#0">
          <Settings email="ada@example.com" />
        </Promptable>
      </main>

      <DotuiDevtools schema={schema} />
    </DotuiPromptProvider>
  );
}
