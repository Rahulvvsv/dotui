import type { Overlay, SchemaFile } from '@dotui/core';

export type SaveOverlayArgs = {
  panelId: string;
  scope?: string;
  appSchemaVersion: number;
  prompt?: string;
  overlay: Overlay;
};

export type OverlayRecord = {
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

export type SaveVisualArgs = {
  scope?: string;
  name: string;
  overlay: Overlay;
};

/** A named, whole-UI snapshot of an overlay the user can switch back to. */
export type SavedVisualRecord = {
  id: number;
  scope: string;
  name: string;
  overlay: Overlay;
  createdAt: string;
};

/** A stored snapshot of the build schema (keyed by content hash; one is current). */
export type SchemaRecord = {
  id: number;
  formatVersion: number;
  hash: string;
  schema: SchemaFile;
  isCurrent: boolean;
  createdAt: string;
};

/**
 * Storage for generated overlays + their history, plus snapshots of the build schema.
 * The interface is the seam: swapping libSQL for Postgres later is a single new
 * implementation, no caller change.
 */
export interface OverlayStore {
  /** Persist a new version for a panel and make it current. */
  save(args: SaveOverlayArgs): Promise<OverlayRecord>;
  /** The current overlay for every panel in a scope, merged for rendering. */
  current(scope?: string): Promise<Overlay>;
  /** Full version history for one panel, newest first. */
  history(panelId: string, scope?: string): Promise<OverlayRecord[]>;
  /** Every stored version across all panels in a scope, newest first (for devtools). */
  list(scope?: string): Promise<OverlayRecord[]>;
  /** Roll a panel back to an earlier version. */
  setCurrent(panelId: string, version: number, scope?: string): Promise<void>;
  /** Save a named whole-UI snapshot (a "saved visual"). */
  saveVisual(args: SaveVisualArgs): Promise<SavedVisualRecord>;
  /** Every saved visual in a scope, newest first. */
  listVisuals(scope?: string): Promise<SavedVisualRecord[]>;
  /** Delete a saved visual by id. */
  deleteVisual(id: number): Promise<void>;
  /** Snapshot the build schema, making it current. Idempotent: identical content is a no-op. */
  saveSchema(schema: SchemaFile): Promise<SchemaRecord>;
  /** The schema snapshot currently marked live, or null if none stored yet. */
  currentSchema(): Promise<SchemaRecord | null>;
  /** Every schema snapshot, newest first (for devtools). */
  listSchemas(): Promise<SchemaRecord[]>;
}
