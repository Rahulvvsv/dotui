import type { Overlay, SchemaFile } from '@dotui/core';

/** Which inspector is showing: the committed build artifact or the live DB table. */
export type DevTab = 'schema' | 'overlays';

/**
 * One row of the `overlays` table as serialized over the wire. Mirrors the store's
 * OverlayRecord, but declared here so the devtools never depends on @dotui/store
 * (and its libSQL/drizzle server deps). The JSON endpoint is the seam between them.
 */
export type OverlayRecordView = {
  id: number;
  panelId: string;
  scope: string;
  appSchemaVersion: number;
  prompt: string | null;
  overlay: Overlay;
  version: number;
  parentVersion: number | null;
  isCurrent: boolean;
  createdAt: string;
};

/** The shape returned by the records endpoint (default GET /api/overlay). */
export type DevtoolsData = {
  current: Overlay;
  records: OverlayRecordView[];
};

export type DotuiDevtoolsProps = {
  /** The committed build artifact the consumer imports (their `.dotui/schema.json`). */
  schema: SchemaFile;
  /**
   * Endpoint returning `DevtoolsData`. Defaults to `/api/overlay`. Pass `null` for
   * schema-only mode (no DB/store) — the Overlays tab is omitted and nothing is polled.
   */
  endpoint?: string | null;
  /** Poll interval in ms while the panel is open. Defaults to 2000. */
  pollMs?: number;
};
