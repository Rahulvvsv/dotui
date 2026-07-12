import type { Overlay, SchemaFile } from '@dotui/core';
import type { Client } from '@libsql/client';
import { and, desc, eq, max } from 'drizzle-orm';
import { type Db, createDb, ensureSchema } from './client';
import { stableHash } from './hash';
import { overlays, schemas, visuals } from './schema';
import type {
  OverlayRecord,
  OverlayStore,
  SaveOverlayArgs,
  SaveVisualArgs,
  SavedVisualRecord,
  SchemaRecord,
} from './types';

const DEFAULT_SCOPE = 'default';

class LibsqlOverlayStore implements OverlayStore {
  private readonly db: Db;
  private readonly client: Client;
  private ensured?: Promise<void>;

  constructor(url: string) {
    const { db, client } = createDb(url);
    this.db = db;
    this.client = client;
  }

  /** Bootstrap the tables once, on first use; concurrent callers share the promise. */
  private ready(): Promise<void> {
    this.ensured ??= ensureSchema(this.client);
    return this.ensured;
  }

  async save(args: SaveOverlayArgs): Promise<OverlayRecord> {
    await this.ready();
    const scope = args.scope ?? DEFAULT_SCOPE;
    const where = and(eq(overlays.panelId, args.panelId), eq(overlays.scope, scope));

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ value: max(overlays.version) })
        .from(overlays)
        .where(where);
      const previous = rows[0]?.value ?? null;
      await tx
        .update(overlays)
        .set({ isCurrent: false })
        .where(and(where, eq(overlays.isCurrent, true)));
      const inserted = await tx
        .insert(overlays)
        .values({
          panelId: args.panelId,
          scope,
          appSchemaVersion: args.appSchemaVersion,
          prompt: args.prompt ?? null,
          overlayJson: JSON.stringify(args.overlay),
          version: (previous ?? 0) + 1,
          parentVersion: previous,
          isCurrent: true,
        })
        .returning();
      return toRecord(inserted[0]);
    });
  }

  async current(scope = DEFAULT_SCOPE): Promise<Overlay> {
    await this.ready();
    const rows = await this.db
      .select()
      .from(overlays)
      .where(and(eq(overlays.scope, scope), eq(overlays.isCurrent, true)));
    const merged: Overlay = {};
    for (const row of rows) Object.assign(merged, JSON.parse(row.overlayJson) as Overlay);
    return merged;
  }

  async history(panelId: string, scope = DEFAULT_SCOPE): Promise<OverlayRecord[]> {
    await this.ready();
    const rows = await this.db
      .select()
      .from(overlays)
      .where(and(eq(overlays.panelId, panelId), eq(overlays.scope, scope)))
      .orderBy(desc(overlays.version));
    return rows.map(toRecord);
  }

  async list(scope = DEFAULT_SCOPE): Promise<OverlayRecord[]> {
    await this.ready();
    const rows = await this.db
      .select()
      .from(overlays)
      .where(eq(overlays.scope, scope))
      .orderBy(desc(overlays.id));
    return rows.map(toRecord);
  }

  async setCurrent(panelId: string, version: number, scope = DEFAULT_SCOPE): Promise<void> {
    await this.ready();
    const where = and(eq(overlays.panelId, panelId), eq(overlays.scope, scope));
    await this.db.transaction(async (tx) => {
      await tx.update(overlays).set({ isCurrent: false }).where(where);
      await tx
        .update(overlays)
        .set({ isCurrent: true })
        .where(and(where, eq(overlays.version, version)));
    });
  }

  async saveVisual(args: SaveVisualArgs): Promise<SavedVisualRecord> {
    await this.ready();
    const inserted = await this.db
      .insert(visuals)
      .values({
        scope: args.scope ?? DEFAULT_SCOPE,
        name: args.name,
        overlayJson: JSON.stringify(args.overlay),
      })
      .returning();
    return toVisualRecord(inserted[0]);
  }

  async listVisuals(scope = DEFAULT_SCOPE): Promise<SavedVisualRecord[]> {
    await this.ready();
    const rows = await this.db
      .select()
      .from(visuals)
      .where(eq(visuals.scope, scope))
      .orderBy(desc(visuals.id));
    return rows.map(toVisualRecord);
  }

  async deleteVisual(id: number): Promise<void> {
    await this.ready();
    await this.db.delete(visuals).where(eq(visuals.id, id));
  }

  async saveSchema(schema: SchemaFile): Promise<SchemaRecord> {
    await this.ready();
    const hash = stableHash(schema);

    return this.db.transaction(async (tx) => {
      await tx.update(schemas).set({ isCurrent: false }).where(eq(schemas.isCurrent, true));
      const existing = await tx.select().from(schemas).where(eq(schemas.hash, hash));
      if (existing[0]) {
        await tx.update(schemas).set({ isCurrent: true }).where(eq(schemas.id, existing[0].id));
        return toSchemaRecord({ ...existing[0], isCurrent: true });
      }
      const inserted = await tx
        .insert(schemas)
        .values({
          formatVersion: schema.version,
          hash,
          schemaJson: JSON.stringify(schema),
          isCurrent: true,
        })
        .returning();
      return toSchemaRecord(inserted[0]);
    });
  }

  async currentSchema(): Promise<SchemaRecord | null> {
    await this.ready();
    const rows = await this.db.select().from(schemas).where(eq(schemas.isCurrent, true));
    return rows[0] ? toSchemaRecord(rows[0]) : null;
  }

  async listSchemas(): Promise<SchemaRecord[]> {
    await this.ready();
    const rows = await this.db.select().from(schemas).orderBy(desc(schemas.id));
    return rows.map(toSchemaRecord);
  }
}

type Row = typeof overlays.$inferSelect;

function toRecord(row: Row | undefined): OverlayRecord {
  if (!row) throw new Error('Overlay insert returned no row.');
  return {
    id: row.id,
    panelId: row.panelId,
    scope: row.scope,
    appSchemaVersion: row.appSchemaVersion,
    prompt: row.prompt,
    overlay: JSON.parse(row.overlayJson) as Overlay,
    version: row.version,
    parentVersion: row.parentVersion,
    isCurrent: row.isCurrent,
    createdAt: row.createdAt,
  };
}

type VisualRow = typeof visuals.$inferSelect;

function toVisualRecord(row: VisualRow | undefined): SavedVisualRecord {
  if (!row) throw new Error('Visual insert returned no row.');
  return {
    id: row.id,
    scope: row.scope,
    name: row.name,
    overlay: JSON.parse(row.overlayJson) as Overlay,
    createdAt: row.createdAt,
  };
}

type SchemaRow = typeof schemas.$inferSelect;

function toSchemaRecord(row: SchemaRow | undefined): SchemaRecord {
  if (!row) throw new Error('Schema insert returned no row.');
  return {
    id: row.id,
    formatVersion: row.formatVersion,
    hash: row.hash,
    schema: JSON.parse(row.schemaJson) as SchemaFile,
    isCurrent: row.isCurrent,
    createdAt: row.createdAt,
  };
}

export function createOverlayStore(url: string): OverlayStore {
  return new LibsqlOverlayStore(url);
}
