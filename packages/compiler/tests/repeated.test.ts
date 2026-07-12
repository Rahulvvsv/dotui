import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { describe, expect, it } from 'vitest';
import { extractFile } from '../src/extract';
import { dotuiBabelPlugin } from '../src/plugin';

const MAP_SRC = `
export function Feed() {
  return (
    <dot.panel className="grid">
      <dot.text>Header</dot.text>
      {items.map((item) => (
        <dot.panel key={item.id} className="card">
          <dot.text>{item.title}</dot.text>
          <dot.badge>{item.meta}</dot.badge>
        </dot.panel>
      ))}
      <dot.button>Load more</dot.button>
    </dot.panel>
  );
}
`;

// Identical to MAP_SRC with the map expression removed — for the id-stability test.
const STATIC_SRC = `
export function Feed() {
  return (
    <dot.panel className="grid">
      <dot.text>Header</dot.text>
      <dot.button>Load more</dot.button>
    </dot.panel>
  );
}
`;

const COND_SRC = `
export function Status() {
  return (
    <dot.panel>
      {ready ? <dot.badge>Ready</dot.badge> : <dot.text>Waiting</dot.text>}
      {show && <dot.badge>Hint</dot.badge>}
    </dot.panel>
  );
}
`;

const NESTED_SRC = `
export function Grid() {
  return (
    <dot.panel>
      {rows.map((row) => (
        <dot.panel key={row.id}>
          {row.cells.map((cell) => (
            <dot.badge key={cell}>{cell}</dot.badge>
          ))}
        </dot.panel>
      ))}
    </dot.panel>
  );
}
`;

const UNSUPPORTED_SRC = `
export function Odd() {
  return <dot.panel>{(() => <dot.badge>x</dot.badge>)()}</dot.panel>;
}
`;

describe('repeated templates (.map)', () => {
  it('assigns ~ ids to mapped dots, marks them repeated, and lists them as children', () => {
    const { schema, warnings } = extractFile('feed.panel.tsx', MAP_SRC);
    expect(warnings).toEqual([]);

    const card = schema.panels['feed/panel#0/panel~0'];
    expect(card).toBeDefined();
    expect(card?.repeated).toBe(true);
    expect(card?.children).toEqual(['feed/panel#0/panel~0/text#0', 'feed/panel#0/panel~0/badge#0']);
    expect(schema.dots['feed/panel#0/panel~0/text#0']?.repeated).toBe(true);
    expect(schema.panels['feed/panel#0']?.children).toEqual([
      'feed/panel#0/text#0',
      'feed/panel#0/panel~0',
      'feed/panel#0/button#0',
    ]);
  });

  it('leaves static ids byte-identical when an expression sibling is added', () => {
    const withMap = extractFile('feed.panel.tsx', MAP_SRC).schema;
    const withoutMap = extractFile('feed.panel.tsx', STATIC_SRC).schema;
    const staticIds = (ids: Record<string, unknown>) =>
      Object.keys(ids).filter((id) => !id.includes('~'));
    expect(staticIds(withMap.panels)).toEqual(Object.keys(withoutMap.panels));
    expect(staticIds(withMap.dots)).toEqual(Object.keys(withoutMap.dots));
  });
});

describe('conditional dots', () => {
  it('assigns ~ ids to ternary branches and && right side, NOT marked repeated', () => {
    const { schema, warnings } = extractFile('status.panel.tsx', COND_SRC);
    expect(warnings).toEqual([]);
    expect(schema.dots['status/panel#0/badge~0']?.repeated).toBeUndefined();
    expect(schema.dots['status/panel#0/text~0']).toBeDefined();
    expect(schema.dots['status/panel#0/badge~1']).toBeDefined();
    expect(schema.panels['status/panel#0']?.children).toEqual([
      'status/panel#0/badge~0',
      'status/panel#0/text~0',
      'status/panel#0/badge~1',
    ]);
  });
});

describe('nested maps', () => {
  it('composes ~ namespaces per parent', () => {
    const { schema } = extractFile('grid.panel.tsx', NESTED_SRC);
    expect(schema.panels['grid/panel#0/panel~0']?.repeated).toBe(true);
    expect(schema.dots['grid/panel#0/panel~0/badge~0']?.repeated).toBe(true);
  });
});

describe('unsupported expression shapes', () => {
  it('warns (never silently skips) and assigns no id', () => {
    const { schema, warnings } = extractFile('odd.panel.tsx', UNSUPPORTED_SRC);
    expect(Object.keys(schema.dots)).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('dot.badge');
    expect(warnings[0]).toContain('not addressable');
  });
});

describe('plugin parity for templates', () => {
  function applyPlugin(code: string, filename: string): t.File {
    const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
    dotuiBabelPlugin().visitor.Program({ node: ast.program }, { file: { opts: { filename } } });
    return ast;
  }

  it('stamps exactly the extractor ids, including ~ template ids', () => {
    const ast = applyPlugin(MAP_SRC, 'feed.panel.tsx');
    const stamped: string[] = [];
    const visit = (node: t.Node): void => {
      if (t.isJSXAttribute(node) && t.isJSXIdentifier(node.name) && node.name.name === '__dotId') {
        if (t.isStringLiteral(node.value)) stamped.push(node.value.value);
      }
      for (const key of Object.keys(node)) {
        const value = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object' && 'type' in item) visit(item as t.Node);
          }
        } else if (value && typeof value === 'object' && 'type' in value) {
          visit(value as t.Node);
        }
      }
    };
    visit(ast.program);

    const { schema } = extractFile('feed.panel.tsx', MAP_SRC);
    const schemaIds = [...Object.keys(schema.panels), ...Object.keys(schema.dots)].sort();
    expect(stamped.sort()).toEqual(schemaIds);
    expect(schemaIds).toContain('feed/panel#0/panel~0');
  });
});

describe('unknown dot kinds inside expressions', () => {
  it('warns instead of silently skipping them', () => {
    const src = `
export function P() {
  return <dot.panel>{show && <dot.txt>x</dot.txt>}</dot.panel>;
}
`;
    const { schema, warnings } = extractFile('p.panel.tsx', src);
    expect(Object.keys(schema.dots)).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Unknown dot kind');
  });
});
