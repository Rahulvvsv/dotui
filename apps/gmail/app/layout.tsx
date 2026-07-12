import type { ReactNode } from 'react';
import { schema } from '../lib/schema';
import { overlayScope } from '../lib/scope';
import { overlayStore } from '../lib/store';
import './globals.css';
import { Shell } from './shell';

export const metadata = { title: 'dotUI — Gmail persona demo' };

// Read the current (persisted) overlay on every request so a reload — or a deep link to a
// /read URL — reflects whatever look was last saved to the database.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Snapshot the committed build schema into the DB (idempotent), then read the live overlay
  // and the user's saved visuals so the switcher is populated on first paint.
  await overlayStore.saveSchema(schema);
  const scope = await overlayScope();
  const [initialOverlay, initialVisuals] = await Promise.all([
    overlayStore.current(scope),
    overlayStore.listVisuals(scope),
  ]);

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <Shell initialOverlay={initialOverlay} initialVisuals={initialVisuals}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
