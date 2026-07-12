/**
 * Combines per-file schema fragments into one SchemaFile, guaranteeing every dot
 * and panel id is unique across the whole app. Ids are auto-generated structurally,
 * so within a file they never clash; the only way to collide is two source files
 * producing the same id scope (same base name) — which this reports as a conflict.
 */

import { ALLOWED_FAMILIES, SCHEMA_VERSION, type SchemaFile } from '@dotui/core';

export type FileSchema = { file: string; schema: SchemaFile };
export type MergeResult = { schema: SchemaFile; conflicts: string[] };

export function mergeSchemas(inputs: FileSchema[]): MergeResult {
  const panels: SchemaFile['panels'] = {};
  const dots: SchemaFile['dots'] = {};
  const seeds = new Set<string>();
  const owners = new Map<string, string>(); // id -> file that first declared it
  const conflicts: string[] = [];

  const add = <T>(target: Record<string, T>, nodes: Record<string, T>, file: string): void => {
    for (const [id, node] of Object.entries(nodes)) {
      const owner = owners.get(id);
      if (owner) {
        conflicts.push(`id "${id}" is declared by both ${owner} and ${file}`);
        continue;
      }
      owners.set(id, file);
      target[id] = node;
    }
  };

  for (const { file, schema } of inputs) {
    add(panels, schema.panels, file);
    add(dots, schema.dots, file);
    for (const cls of schema.palette.seededFromAuthor) seeds.add(cls);
  }

  return {
    schema: {
      version: SCHEMA_VERSION,
      panels,
      dots,
      palette: { seededFromAuthor: [...seeds].sort(), families: [...ALLOWED_FAMILIES] },
    },
    conflicts,
  };
}
