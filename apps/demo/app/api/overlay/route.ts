import type { Overlay } from '@dotui/elements';
import { NextResponse } from 'next/server';
import schema from '../../../.dotui/schema.json';
import { overlayScope } from '../../../lib/scope';
import { overlayStore } from '../../../lib/store';

export const dynamic = 'force-dynamic';

type SaveBody = { panelId?: string; overlay?: Overlay; prompt?: string };

export async function GET() {
  const scope = await overlayScope();
  const [current, records] = await Promise.all([
    overlayStore.current(scope),
    overlayStore.list(scope),
  ]);
  return NextResponse.json({ current, records });
}

export async function POST(request: Request) {
  const body = (await request.json()) as SaveBody;
  if (!body.panelId || !body.overlay) {
    return NextResponse.json({ error: 'panelId and overlay are required.' }, { status: 400 });
  }
  const scope = await overlayScope();
  await overlayStore.save({
    panelId: body.panelId,
    overlay: body.overlay,
    prompt: body.prompt,
    appSchemaVersion: schema.version,
    scope,
  });
  return NextResponse.json({ current: await overlayStore.current(scope) });
}
