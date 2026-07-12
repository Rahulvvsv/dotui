import { describe, expect, it } from 'vitest';
import { DEFAULT_ELEMENT, SCHEMA_VERSION, schemaFileSchema } from '../src/index';

describe('schema contract', () => {
  it('accepts a well-formed schema file', () => {
    const result = schemaFileSchema.safeParse({
      version: SCHEMA_VERSION,
      panels: {
        'home/panel#0': {
          id: 'home/panel#0',
          kind: 'panel',
          element: 'div',
          className: 'flex',
          dynamicClassName: false,
          children: ['home/panel#0/text#0'],
        },
      },
      dots: {
        'home/panel#0/text#0': {
          id: 'home/panel#0/text#0',
          kind: 'text',
          element: 'p',
          className: '',
          dynamicClassName: false,
          required: false,
          content: [{ kind: 'static', value: 'hello world' }],
        },
      },
      palette: { seededFromAuthor: [], families: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown dot kind', () => {
    const result = dotWithKind('video');
    expect(result.success).toBe(false);
  });

  it('maps kinds to default elements', () => {
    expect(DEFAULT_ELEMENT.panel).toBe('div');
    expect(DEFAULT_ELEMENT.text).toBe('p');
  });
});

function dotWithKind(kind: string) {
  return schemaFileSchema.safeParse({
    version: SCHEMA_VERSION,
    panels: {},
    dots: {
      x: {
        id: 'x',
        kind,
        element: 'p',
        className: '',
        dynamicClassName: false,
        required: false,
        content: [],
      },
    },
    palette: { seededFromAuthor: [], families: [] },
  });
}
