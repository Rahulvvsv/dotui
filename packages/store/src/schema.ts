/**
 * Drizzle table for generated overlays. Every generation is a new versioned row;
 * the current row per (scope, panelId) carries is_current = true. This gives full
 * history (track updates / roll back) plus a fast "what's live now" read.
 */

import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const overlays = sqliteTable('overlays', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  panelId: text('panel_id').notNull(),
  scope: text('scope').notNull().default('default'),
  appSchemaVersion: integer('app_schema_version').notNull(),
  prompt: text('prompt'),
  overlayJson: text('overlay_json').notNull(),
  version: integer('version').notNull(),
  parentVersion: integer('parent_version'),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

/** DDL kept alongside the table so a fresh DB can be bootstrapped without drizzle-kit. */
export const OVERLAYS_DDL = `
CREATE TABLE IF NOT EXISTS overlays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'default',
  app_schema_version INTEGER NOT NULL,
  prompt TEXT,
  overlay_json TEXT NOT NULL,
  version INTEGER NOT NULL,
  parent_version INTEGER,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export const OVERLAYS_INDEX_DDL =
  'CREATE INDEX IF NOT EXISTS idx_overlays_current ON overlays(scope, panel_id, is_current);';

/**
 * Snapshots of the committed build schema. The file (`.dotui/schema.json`) stays the
 * source of truth; this records each distinct content as it changes over time, keyed
 * by a stable content hash (unique → dedup). `is_current = true` marks the live one,
 * mirroring the overlays model. Lets overlays/history be read against the exact schema
 * they targeted, without making the DB authoritative over a build artifact.
 */
export const schemas = sqliteTable('schemas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  formatVersion: integer('format_version').notNull(),
  hash: text('hash').notNull(),
  schemaJson: text('schema_json').notNull(),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const SCHEMAS_DDL = `
CREATE TABLE IF NOT EXISTS schemas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  format_version INTEGER NOT NULL,
  hash TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export const SCHEMAS_INDEX_DDL =
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_schemas_hash ON schemas(hash);';

/**
 * Named, whole-UI snapshots of an overlay — the user's "saved visuals". Unlike `overlays`
 * (per-panel version history), a visual is one absolute snapshot of the entire look that
 * the user names and switches back to. Distinct from history: history tracks how the live
 * look evolved; visuals are deliberate bookmarks the user can jump between.
 */
export const visuals = sqliteTable('visuals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scope: text('scope').notNull().default('default'),
  name: text('name').notNull(),
  overlayJson: text('overlay_json').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const VISUALS_DDL = `
CREATE TABLE IF NOT EXISTS visuals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  overlay_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export const VISUALS_INDEX_DDL =
  'CREATE INDEX IF NOT EXISTS idx_visuals_scope ON visuals(scope, id);';
