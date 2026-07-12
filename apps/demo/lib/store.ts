import { createOverlayStore } from '@dotui/store';

// One libSQL database alongside the schema. A local file in dev; point
// DOTUI_DB_URL at a hosted libsql:// connection in production — no code change.
const url = process.env.DOTUI_DB_URL ?? 'file:.dotui/dotui.db';

export const overlayStore = createOverlayStore(url);
