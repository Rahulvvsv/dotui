/** `dotui build <glob...> [--out <path>]` — extract a schema file from panel sources. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { schemaFileSchema } from '@dotui/core';
import fg from 'fast-glob';
import { extractFile } from './extract';
import { type FileSchema, mergeSchemas } from './merge';

const DEFAULT_OUT = '.dotui/schema.json';
const DEFAULT_GLOB = '**/*.panel.tsx';

export function run(argv: string[]): number {
  if (argv[0] !== 'build') {
    console.error('Usage: dotui build <glob...> [--out <path>]');
    return 1;
  }

  const { patterns, out } = parseArgs(argv.slice(1));
  const files = fg.sync(patterns, {
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
  });
  if (files.length === 0) {
    console.error(`No files matched: ${patterns.join(', ')}`);
    return 1;
  }

  const inputs: FileSchema[] = [];
  for (const file of files) {
    const name = relative(process.cwd(), file);
    const { schema, warnings } = extractFile(file, readFileSync(file, 'utf8'));
    inputs.push({ file: name, schema });
    for (const warning of warnings) console.warn(`  ! ${name}: ${warning}`);
    console.log(`  + ${name} — ${count(schema.panels)} panel(s), ${count(schema.dots)} dot(s)`);
  }

  const { schema: merged, conflicts } = mergeSchemas(inputs);
  if (conflicts.length > 0) {
    const list = conflicts.map((c) => `  ✗ ${c}`).join('\n');
    console.error(
      `Schema id conflicts (every dot/panel id must be unique):\n${list}\nCause: two source files share a base name, so they produce the same id scope. Rename one.`,
    );
    return 1;
  }

  const parsed = schemaFileSchema.safeParse(merged);
  if (!parsed.success) {
    console.error(`Generated schema failed validation:\n${parsed.error.message}`);
    return 1;
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${out} — ${count(merged.panels)} panels, ${count(merged.dots)} dots.`);
  return 0;
}

function parseArgs(args: string[]): { patterns: string[]; out: string } {
  const patterns: string[] = [];
  let out = DEFAULT_OUT;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out') {
      out = args[++i] ?? DEFAULT_OUT;
    } else if (arg && !arg.startsWith('--')) {
      patterns.push(arg);
    }
  }
  if (patterns.length === 0) patterns.push(DEFAULT_GLOB);
  return { patterns, out };
}

const count = (record: Record<string, unknown>): number => Object.keys(record).length;
