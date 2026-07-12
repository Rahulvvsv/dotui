import { describe, expect, it } from 'vitest';
import { extractFile } from '../src/extract';
import { mergeSchemas } from '../src/merge';

const PANEL = (text: string) =>
  `import { dot } from '@dotui/elements';
   export function P() { return <dot.panel>${text}</dot.panel>; }`;

describe('mergeSchemas', () => {
  it('combines distinct files without conflict', () => {
    const a = extractFile('profile.panel.tsx', PANEL('<dot.text>a</dot.text>'));
    const b = extractFile('settings.panel.tsx', PANEL('<dot.text>b</dot.text>'));
    const { schema, conflicts } = mergeSchemas([
      { file: 'profile.panel.tsx', schema: a.schema },
      { file: 'settings.panel.tsx', schema: b.schema },
    ]);
    expect(conflicts).toHaveLength(0);
    expect(Object.keys(schema.panels)).toEqual(['profile/panel#0', 'settings/panel#0']);
  });

  it('reports a conflict when two files yield the same id scope', () => {
    // Same base name -> same scope -> colliding ids.
    const a = extractFile('home.panel.tsx', PANEL('<dot.text>a</dot.text>'));
    const b = extractFile('home.panel.tsx', PANEL('<dot.text>b</dot.text>'));
    const { conflicts } = mergeSchemas([
      { file: 'a/home.panel.tsx', schema: a.schema },
      { file: 'b/home.panel.tsx', schema: b.schema },
    ]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toContain('home/panel#0');
  });
});
