# @dotui/devtools

A drop-in inspector so developers can SEE what dotUI is doing: the schema the
build produced and the overlays the DB is holding.

## Usage

```tsx
import { DotuiDevtools } from '@dotui/devtools';
import { schema } from '../lib/schema';

<DotuiDevtools schema={schema} />                 // polls /api/overlay for DB rows
<DotuiDevtools schema={schema} endpoint={null} /> // schema-only mode (no server)
<DotuiDevtools schema={schema} endpoint="/api/x" pollMs={5000} />
```

- **Schema tab** — the committed build artifact: palette, panels, dots, content
  slots, `required`/`description` metadata.
- **Overlays (DB) tab** — the `overlays` table: per-version rows expandable to
  every column plus the stored overlay JSON.

Deliberately decoupled from `@dotui/store`: it consumes the wire JSON via its
own `OverlayRecordView` type, so no libSQL ends up in the client bundle — the
endpoint is the seam.

Consumer wiring (Next.js): add `@dotui/devtools` to `transpilePackages` and
`packages/devtools/src/**` to the Tailwind `content` globs.
