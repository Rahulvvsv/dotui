import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SchemaFile } from '@dotui/core';
import { describe, expect, it } from 'vitest';
import { createOverlayStore } from '../src/store';

const PANEL = 'home/panel#0';

// A fresh temp file per test. libSQL transactions don't share an in-memory db
// across connections, so `:memory:` is unsuitable here; a file behaves like prod.
function freshUrl(name: string): string {
  const path = join(tmpdir(), `dotui-test-${name}.db`);
  rmSync(path, { force: true });
  rmSync(`${path}-journal`, { force: true });
  return `file:${path.replace(/\\/g, '/')}`;
}

describe('OverlayStore (file-backed libSQL)', () => {
  it('versions saves and exposes the latest as current', async () => {
    const store = createOverlayStore(freshUrl('versions'));

    const v1 = await store.save({
      panelId: PANEL,
      appSchemaVersion: 1,
      prompt: 'first',
      overlay: { [PANEL]: { className: 'p-2' } },
    });
    const v2 = await store.save({
      panelId: PANEL,
      appSchemaVersion: 1,
      prompt: 'second',
      overlay: { [PANEL]: { className: 'p-8' } },
    });

    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v2.parentVersion).toBe(1);

    const current = await store.current();
    expect(current[PANEL]?.className).toBe('p-8');

    const history = await store.history(PANEL);
    expect(history.map((r) => r.version)).toEqual([2, 1]);
  });

  it('merges current overlays across panels', async () => {
    const store = createOverlayStore(freshUrl('merge'));
    await store.save({ panelId: 'a', appSchemaVersion: 1, overlay: { a: { className: 'red' } } });
    await store.save({ panelId: 'b', appSchemaVersion: 1, overlay: { b: { className: 'blue' } } });

    const current = await store.current();
    expect(current).toEqual({ a: { className: 'red' }, b: { className: 'blue' } });
  });

  it('lists every stored version across panels, newest first', async () => {
    const store = createOverlayStore(freshUrl('list'));
    await store.save({ panelId: 'a', appSchemaVersion: 1, overlay: { a: {} } });
    await store.save({ panelId: 'b', appSchemaVersion: 1, overlay: { b: {} } });
    await store.save({ panelId: 'a', appSchemaVersion: 1, overlay: { a: {} } });

    const all = await store.list();
    expect(all).toHaveLength(3);
    expect(all.map((r) => r.panelId)).toEqual(['a', 'b', 'a']); // newest id first
  });

  it('rolls a panel back to an earlier version', async () => {
    const store = createOverlayStore(freshUrl('rollback'));
    await store.save({
      panelId: PANEL,
      appSchemaVersion: 1,
      overlay: { [PANEL]: { className: 'v1' } },
    });
    await store.save({
      panelId: PANEL,
      appSchemaVersion: 1,
      overlay: { [PANEL]: { className: 'v2' } },
    });

    await store.setCurrent(PANEL, 1);
    const current = await store.current();
    expect(current[PANEL]?.className).toBe('v1');
  });
});

describe('OverlayStore saved visuals', () => {
  it('saves named visuals and lists them newest-first', async () => {
    const store = createOverlayStore(freshUrl('visuals'));
    const minimal = await store.saveVisual({
      name: 'Minimal',
      overlay: { [PANEL]: { hidden: true } },
    });
    const dark = await store.saveVisual({
      name: 'Dark',
      overlay: { [PANEL]: { className: 'bg-slate-900' } },
    });

    expect(minimal.id).toBeLessThan(dark.id);

    const all = await store.listVisuals();
    expect(all.map((v) => v.name)).toEqual(['Dark', 'Minimal']);
    expect(all[0]?.overlay).toEqual({ [PANEL]: { className: 'bg-slate-900' } });
  });

  it('deletes a saved visual by id', async () => {
    const store = createOverlayStore(freshUrl('visuals-delete'));
    const v = await store.saveVisual({ name: 'Temp', overlay: {} });
    await store.deleteVisual(v.id);
    expect(await store.listVisuals()).toHaveLength(0);
  });
});

function makeSchema(extra: Record<string, unknown> = {}): SchemaFile {
  return {
    version: 1,
    panels: {},
    dots: {},
    palette: { seededFromAuthor: [], families: [] },
    ...extra,
  } as SchemaFile;
}

describe('OverlayStore schema snapshots', () => {
  it('snapshots a schema and exposes it as current', async () => {
    const store = createOverlayStore(freshUrl('schema-save'));
    const rec = await store.saveSchema(makeSchema());
    expect(rec.isCurrent).toBe(true);
    expect(rec.formatVersion).toBe(1);

    const current = await store.currentSchema();
    expect(current?.hash).toBe(rec.hash);
  });

  it('is idempotent — identical content does not create a new snapshot', async () => {
    const store = createOverlayStore(freshUrl('schema-idempotent'));
    await store.saveSchema(makeSchema());
    await store.saveSchema(makeSchema());

    const all = await store.listSchemas();
    expect(all).toHaveLength(1);
  });

  it('records a new snapshot when content changes and makes it current', async () => {
    const store = createOverlayStore(freshUrl('schema-change'));
    const v1 = await store.saveSchema(makeSchema());
    const v2 = await store.saveSchema(
      makeSchema({ palette: { seededFromAuthor: ['p-4'], families: [] } }),
    );

    expect(v2.hash).not.toBe(v1.hash);

    const all = await store.listSchemas();
    expect(all).toHaveLength(2);
    expect(all[0]?.id).toBe(v2.id); // newest first
    expect(all.filter((s) => s.isCurrent).map((s) => s.id)).toEqual([v2.id]); // exactly one current
  });
});
