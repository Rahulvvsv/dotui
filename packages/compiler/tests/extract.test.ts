import { describe, expect, it } from 'vitest';
import { extractFile } from '../src/extract';

const SAMPLE = `
import { dot } from '@dotui/elements';
export function Home({ name }: { name: string }) {
  return (
    <dot.panel className="flex flex-col gap-4 p-6">
      <dot.text>hello world</dot.text>
      <dot.text type="h1" className="bg-red-500">{name}</dot.text>
    </dot.panel>
  );
}
`;

describe('extractFile', () => {
  const { schema, warnings } = extractFile('home.panel.tsx', SAMPLE);

  it('produces deterministic structural ids', () => {
    expect(Object.keys(schema.panels)).toEqual(['home/panel#0']);
    expect(Object.keys(schema.dots)).toEqual(['home/panel#0/text#0', 'home/panel#0/text#1']);
  });

  it('captures element tags from the type prop', () => {
    expect(schema.panels['home/panel#0']?.element).toBe('div');
    expect(schema.dots['home/panel#0/text#0']?.element).toBe('p');
    expect(schema.dots['home/panel#0/text#1']?.element).toBe('h1');
  });

  it("keeps the developer's classes verbatim and seeds the palette", () => {
    expect(schema.panels['home/panel#0']?.className).toBe('flex flex-col gap-4 p-6');
    expect(schema.dots['home/panel#0/text#1']?.className).toBe('bg-red-500');
    expect(schema.palette.seededFromAuthor).toContain('bg-red-500');
    expect(schema.palette.seededFromAuthor).toContain('flex');
  });

  it('records static text and dynamic expressions as content', () => {
    expect(schema.dots['home/panel#0/text#0']?.content).toEqual([
      { kind: 'static', value: 'hello world' },
    ]);
    expect(schema.dots['home/panel#0/text#1']?.content).toEqual([
      { kind: 'dynamic', expr: 'name' },
    ]);
  });

  it('lists panel children in source order', () => {
    expect(schema.panels['home/panel#0']?.children).toEqual([
      'home/panel#0/text#0',
      'home/panel#0/text#1',
    ]);
    expect(warnings).toHaveLength(0);
  });

  it('defaults required to false and omits an absent description', () => {
    expect(schema.dots['home/panel#0/text#0']?.required).toBe(false);
    expect(schema.dots['home/panel#0/text#0']?.description).toBeUndefined();
  });
});

describe('extractFile — required and description', () => {
  const SRC = `
import { dot } from '@dotui/elements';
export function Form() {
  return (
    <dot.panel description="The signup form">
      <dot.button required description="Primary submit action">Save</dot.button>
    </dot.panel>
  );
}
`;
  const { schema } = extractFile('form.panel.tsx', SRC);

  it('captures a panel description', () => {
    expect(schema.panels['form/panel#0']?.description).toBe('The signup form');
  });

  it('captures required (bare prop -> true) and description on a dot', () => {
    const button = schema.dots['form/panel#0/button#0'];
    expect(button?.required).toBe(true);
    expect(button?.description).toBe('Primary submit action');
  });
});
