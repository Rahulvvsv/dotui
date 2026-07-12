import { useState } from 'react';
import type { OverlayRecordView } from './types';

/** Columns of the `overlays` table, shown as a legend so the shape is explicit. */
const COLUMNS = [
  'id',
  'panel_id',
  'scope',
  'app_schema_version',
  'version',
  'parent_version',
  'is_current',
  'prompt',
  'overlay_json',
  'created_at',
];

/**
 * Read-only inspector for the `overlays` DB table. One versioned row per
 * generation; rows are grouped by panel (newest first) and expand to reveal
 * every column value plus the parsed overlay JSON (per-dot className/style).
 */
export function OverlaysView({ records }: { records: OverlayRecordView[] }) {
  const panels = groupByPanel(records);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400">
        Table <span className="font-mono text-slate-200">overlays</span> · {records.length} rows
      </p>
      <div className="flex flex-wrap gap-1">
        {COLUMNS.map((col) => (
          <span
            key={col}
            className="rounded bg-slate-800 px-1 font-mono text-[10px] text-slate-400"
          >
            {col}
          </span>
        ))}
      </div>

      {panels.length === 0 ? (
        <p className="p-3 text-slate-400">No overlays saved yet — generate or pick a preset.</p>
      ) : (
        panels.map(([panelId, versions]) => (
          <div key={panelId} className="flex flex-col gap-1">
            <p className="break-all font-mono text-[11px] text-emerald-300">{panelId}</p>
            {versions.map((record) => (
              <Row key={record.id} record={record} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

function Row({ record }: { record: OverlayRecordView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded bg-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1 text-left"
      >
        <span className="text-slate-500">{open ? '▾' : '▸'}</span>
        <span className="font-mono text-slate-400">v{record.version}</span>
        <span className="truncate text-slate-200">{record.prompt ?? '—'}</span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {record.createdAt.slice(11, 19)}
        </span>
        {record.isCurrent && (
          <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">live</span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-slate-700 px-2 py-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[10px]">
            <Field label="id" value={record.id} />
            <Field label="scope" value={record.scope} />
            <Field label="app_schema_version" value={record.appSchemaVersion} />
            <Field label="version" value={record.version} />
            <Field label="parent_version" value={record.parentVersion ?? '—'} />
            <Field label="is_current" value={String(record.isCurrent)} />
            <Field label="created_at" value={record.createdAt} />
          </dl>
          <div>
            <p className="mb-1 text-[10px] text-slate-500">
              overlay_json · {Object.keys(record.overlay).length} dots styled
            </p>
            <pre className="overflow-auto rounded bg-slate-950 p-2 font-mono text-[10px] text-slate-300">
              {JSON.stringify(record.overlay, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="break-all text-slate-200">{value}</dd>
    </>
  );
}

function groupByPanel(records: OverlayRecordView[]): [string, OverlayRecordView[]][] {
  const map = new Map<string, OverlayRecordView[]>();
  for (const record of records) {
    const list = map.get(record.panelId) ?? [];
    list.push(record);
    map.set(record.panelId, list);
  }
  return [...map.entries()];
}
