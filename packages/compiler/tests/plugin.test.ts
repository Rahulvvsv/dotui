import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';
import { extractFile } from '../src/extract';
import { dotuiBabelPlugin } from '../src/plugin';

const SAMPLE = `
import { dot } from '@dotui/elements';
export function Home({ name }: { name: string }) {
  return (
    <dot.panel className="flex">
      <dot.text>hi</dot.text>
      <dot.text type="h1">{name}</dot.text>
    </dot.panel>
  );
}
`;

/** Depth-first walk over every node reachable from `root`. */
function walkAll(root: t.Node, visit: (node: t.Node) => void): void {
  visit(root);
  for (const key of Object.keys(root)) {
    const value = (root as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object' && 'type' in item) walkAll(item as t.Node, visit);
      }
    } else if (value && typeof value === 'object' && 'type' in value) {
      walkAll(value as t.Node, visit);
    }
  }
}

function applyPlugin(code: string, filename: string): t.File {
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  dotuiBabelPlugin().visitor.Program({ node: ast.program }, { file: { opts: { filename } } });
  return ast;
}

function collectDotIds(ast: t.File): string[] {
  const ids: string[] = [];
  walkAll(ast.program, (node) => {
    if (!t.isJSXAttribute(node)) return;
    if (!t.isJSXIdentifier(node.name) || node.name.name !== '__dotId') return;
    if (t.isStringLiteral(node.value)) ids.push(node.value.value);
  });
  return ids;
}

describe('dotuiBabelPlugin', () => {
  it('stamps exactly the ids the extractor emits', () => {
    const stamped = collectDotIds(applyPlugin(SAMPLE, 'home.panel.tsx')).sort();
    const { schema } = extractFile('home.panel.tsx', SAMPLE);
    const schemaIds = [...Object.keys(schema.panels), ...Object.keys(schema.dots)].sort();
    expect(stamped).toEqual(schemaIds);
  });

  it('is idempotent — re-stamping adds no duplicates', () => {
    const ast = applyPlugin(SAMPLE, 'home.panel.tsx');
    dotuiBabelPlugin().visitor.Program(
      { node: ast.program },
      { file: { opts: { filename: 'home.panel.tsx' } } },
    );
    expect(collectDotIds(ast)).toHaveLength(3); // one panel + two texts, no duplicates
  });
});
