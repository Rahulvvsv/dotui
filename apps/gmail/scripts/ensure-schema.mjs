// Runs before `dev`/`build` (npm pre-hooks). The schema is a build artifact compiled
// from app/*.panel.tsx; if it's missing (e.g. someone deleted .dotui/schema.json), a
// static `import` of it would fail with an opaque bundler error. Regenerate it instead.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const OUT = '.dotui/schema.json';
const CLI = '../../packages/compiler/dist/bin.cjs';

if (existsSync(OUT)) process.exit(0);

console.log(`[dotui] ${OUT} is missing — generating it from app/*.panel.tsx ...`);

if (!existsSync(CLI)) {
  console.error(
    `[dotui] Compiler not built (${CLI} not found).
        Build the packages first:
          corepack pnpm -r --filter "@dotui/*" run build`,
  );
  process.exit(1);
}

try {
  execFileSync('node', [CLI, 'build', 'app/**/*.panel.tsx', '--out', OUT], { stdio: 'inherit' });
} catch {
  console.error('[dotui] Failed to generate the schema. Run the build above, then retry.');
  process.exit(1);
}
