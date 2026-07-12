# @dotui/store

Server-side persistence on Drizzle + libSQL. One factory —
`createOverlayStore(url)` — returns the `OverlayStore` interface (the seam; a
Postgres implementation would swap in behind it). `file:./x.db` locally,
`libsql://…` (Turso) in prod via `DOTUI_DB_URL`; tables bootstrap themselves on
first use (raw DDL, no drizzle-kit).

## Three tables, three jobs

| table | what it is | key methods |
|---|---|---|
| `overlays` | versioned history of the live look, per `(scope, panelId)`; `is_current` marks the live row | `save`, `current`, `history`, `setCurrent` (rollback), `list` |
| `visuals` | named whole-UI snapshots the user deliberately saves and switches between | `saveVisual`, `listVisuals`, `deleteVisual` |
| `schemas` | content-hash-deduped snapshots of the committed build schema — a history LOG, never the live read source (the file `.dotui/schema.json` stays authoritative) | `saveSchema` (idempotent), `currentSchema`, `listSchemas` |

Every `save` inserts a new version row and repoints `is_current` in one
transaction — nothing is overwritten, so history and rollback are always intact.

## Example

```ts
const store = createOverlayStore(process.env.DOTUI_DB_URL ?? 'file:.dotui/dotui.db');
await store.save({ panelId: 'app', overlay, appSchemaVersion: 1, prompt: 'dark mode' });
const live = await store.current();       // merged is_current rows for the scope
await store.setCurrent('app', 3);         // roll back to version 3
```

Note: libSQL is a native module — Next.js apps must list `@libsql/client` +
`libsql` in `serverExternalPackages`.
