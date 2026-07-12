import { type Client, createClient } from '@libsql/client';
import { type LibSQLDatabase, drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import {
  OVERLAYS_DDL,
  OVERLAYS_INDEX_DDL,
  SCHEMAS_DDL,
  SCHEMAS_INDEX_DDL,
  VISUALS_DDL,
  VISUALS_INDEX_DDL,
} from './schema';

export type Db = LibSQLDatabase<typeof schema>;

/** A libSQL connection: `file:./x.db` locally, `libsql://...` hosted (same code). */
export function createDb(url: string): { db: Db; client: Client } {
  const client = createClient({ url });
  return { db: drizzle(client, { schema }), client };
}

export async function ensureSchema(client: Client): Promise<void> {
  await client.execute(OVERLAYS_DDL);
  await client.execute(OVERLAYS_INDEX_DDL);
  await client.execute(SCHEMAS_DDL);
  await client.execute(SCHEMAS_INDEX_DDL);
  await client.execute(VISUALS_DDL);
  await client.execute(VISUALS_INDEX_DDL);
}
