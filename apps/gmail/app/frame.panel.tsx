import { dot } from '@dotui/elements';
import type { ReactNode } from 'react';

/**
 * The app root, authored entirely in dotUI. A single base `dot.panel` that fills the
 * viewport and stacks the top bar over a body row (the sidebar beside the main content).
 * Sub-panels are passed in as slots so each keeps its own schema scope while living inside
 * this one base panel.
 */
export function Frame({ topbar, body }: { topbar: ReactNode; body: ReactNode }) {
  return (
    <dot.panel
      description="Application root — fills the viewport and stacks the top bar over the body."
      className="flex h-screen w-full flex-col bg-slate-50 text-slate-900"
    >
      {topbar}
      <dot.panel
        description="Body row — the sidebar beside the main content area."
        className="flex min-h-0 flex-1"
      >
        {body}
      </dot.panel>
    </dot.panel>
  );
}
