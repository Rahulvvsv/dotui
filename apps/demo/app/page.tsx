import { schema } from '../lib/schema';
import { overlayScope } from '../lib/scope';
import { overlayStore } from '../lib/store';
import { Shell } from './shell';

// Read the current (persisted) overlay on every request so a reload reflects
// whatever was last saved to the database.
export const dynamic = 'force-dynamic';

export default async function Page() {
  // Snapshot the committed build schema into the DB. Idempotent (deduped by content
  // hash), so this only inserts a new row when schema.json actually changes.
  await overlayStore.saveSchema(schema);
  const initialOverlay = await overlayStore.current(await overlayScope());
  return <Shell initialOverlay={initialOverlay} />;
}
