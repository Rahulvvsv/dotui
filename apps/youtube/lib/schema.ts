import type { SchemaFile } from '@dotui/devtools';
import schemaJson from '../.dotui/schema.json';

/**
 * The committed build schema — compiled from `app/*.panel.tsx` by `dotui build`, so it
 * ships in lockstep with the components it describes. Single import site for the app
 * (the shell passes it to the devtools in schema-only mode).
 *
 * Regenerate with `corepack pnpm --filter @dotui/youtube run schema`. It is also
 * auto-generated if missing on `dev`/`build` (see `scripts/ensure-schema.mjs`).
 */
export const schema = schemaJson as unknown as SchemaFile;
