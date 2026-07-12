import { cookies } from 'next/headers';

/**
 * The per-visitor overlay scope: the anonymous `dotui_uid` cookie set by
 * middleware. Falls back to 'default' if it is somehow absent (middleware runs
 * before any page or route, so this is belt-and-braces).
 */
export async function overlayScope(): Promise<string> {
  const store = await cookies();
  return store.get('dotui_uid')?.value ?? 'default';
}
