import type { ReactNode } from 'react';
import { schema } from '../lib/schema';
import { overlayScope } from '../lib/scope';
import { overlayStore } from '../lib/store';
import './globals.css';
import { Shell } from './shell';

export const metadata = { title: 'dotUI — YouTube persona demo' };

// Read the current (persisted) overlay on every request so a reload — or a deep link to a
// /watch URL — reflects whatever look was last saved to the database.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Snapshot the committed build schema into the DB (idempotent), then read the live overlay.
  await overlayStore.saveSchema(schema);
  const initialOverlay = await overlayStore.current(await overlayScope());

  return (
    <html lang="en">
      <body className="bg-white text-slate-900">
        <Shell initialOverlay={initialOverlay}>{children}</Shell>
      </body>
    </html>
  );
}
