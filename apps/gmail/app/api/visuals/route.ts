import type { Overlay } from '@dotui/elements';
import { NextResponse } from 'next/server';
import { overlayScope } from '../../../lib/scope';
import { overlayStore } from '../../../lib/store';

export const dynamic = 'force-dynamic';

type SaveBody = { name?: string; overlay?: Overlay };

// List this visitor's saved visuals (named whole-UI snapshots).
export async function GET() {
  const visuals = await overlayStore.listVisuals(await overlayScope());
  return NextResponse.json({ visuals });
}

// Save the current look as a named visual and return the stored record (with its real id).
export async function POST(request: Request) {
  const body = (await request.json()) as SaveBody;
  const name = body.name?.trim();
  if (!name || !body.overlay) {
    return NextResponse.json({ error: 'name and overlay are required.' }, { status: 400 });
  }
  const scope = await overlayScope();
  const visual = await overlayStore.saveVisual({ name, overlay: body.overlay, scope });
  return NextResponse.json({ visual });
}

// Delete one of this visitor's visuals. The scope check stops cross-user deletes.
export async function DELETE(request: Request) {
  const raw = new URL(request.url).searchParams.get('id');
  const id = raw === null ? Number.NaN : Number(raw);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'id must be an integer.' }, { status: 400 });
  }
  const scope = await overlayScope();
  const visuals = await overlayStore.listVisuals(scope);
  if (!visuals.some((v) => v.id === id)) {
    return NextResponse.json({ error: 'No such visual in your scope.' }, { status: 404 });
  }
  await overlayStore.deleteVisual(id);
  return NextResponse.json({ ok: true });
}
