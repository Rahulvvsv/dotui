'use client';

import { useState } from 'react';
import { OverlaysView } from './overlays-view';
import { SchemaView } from './schema-view';
import type { DevTab, DotuiDevtoolsProps } from './types';
import { useOverlayRecords } from './use-overlay-records';

/**
 * A TanStack-Devtools-style panel for any dotUI consumer: a floating button that
 * opens a live inspector with two tabs — the committed build schema (the constant
 * contract the LLM reads) and the `overlays` DB table (every saved version + its
 * stored JSON). Read-only. The app supplies its `schema` and (optionally) the
 * records `endpoint`; the component owns the UI and polling. Tailwind-styled.
 */
export function DotuiDevtools({
  schema,
  endpoint = '/api/overlay',
  pollMs = 2000,
}: DotuiDevtoolsProps) {
  const hasStore = endpoint !== null;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DevTab>(hasStore ? 'overlays' : 'schema');
  const { current, records } = useOverlayRecords(endpoint, pollMs, open);
  const styledDots = Object.keys(current).length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-slate-700"
      >
        ◧ dotUI devtools
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[75vh] w-[28rem] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2 text-xs">
        <span className="font-semibold">dotUI devtools</span>
        <span className="text-slate-400">
          {hasStore
            ? `${records.length} versions · ${styledDots} dots styled`
            : `${Object.keys(schema.panels).length} panels · ${Object.keys(schema.dots).length} dots`}
        </span>
        <span className="ml-auto flex items-center gap-1 text-emerald-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> live
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-2 text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-700 px-2 py-1.5 text-xs">
        {hasStore && (
          <TabButton
            label="Overlays (DB)"
            active={tab === 'overlays'}
            onClick={() => setTab('overlays')}
          />
        )}
        <TabButton label="Schema" active={tab === 'schema'} onClick={() => setTab('schema')} />
      </div>

      <div className="flex-1 overflow-auto p-2 text-xs">
        {hasStore && tab === 'overlays' ? (
          <OverlaysView records={records} />
        ) : (
          <SchemaView schema={schema} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 font-medium ${
        active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
