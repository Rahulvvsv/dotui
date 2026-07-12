import type { SchemaFile } from '@dotui/core';
import { describe, expect, it } from 'vitest';
import type { GenerateRequest, OpenAIClient, OpenAIRequestBody } from '../src';
import { generatePanelOverlay } from '../src/generate';
import { mockGenerator } from '../src/mock';
import { openaiGenerator } from '../src/openai';
import { parseOpenAIOverlay } from '../src/openai-parse';
import { panelSlice } from '../src/slice';

const schema: SchemaFile = {
  version: 1,
  panels: {
    'p/panel#0': {
      id: 'p/panel#0',
      kind: 'panel',
      element: 'div',
      className: 'flex',
      dynamicClassName: false,
      description: 'Profile header',
      children: ['p/panel#0/text#0', 'p/panel#0/image#0', 'p/panel#0/panel#0'],
    },
    'p/panel#0/panel#0': {
      id: 'p/panel#0/panel#0',
      kind: 'panel',
      element: 'div',
      className: '',
      dynamicClassName: false,
      children: ['p/panel#0/panel#0/badge#0'],
    },
  },
  dots: {
    'p/panel#0/text#0': {
      id: 'p/panel#0/text#0',
      kind: 'text',
      element: 'h2',
      className: 'text-sm',
      dynamicClassName: false,
      required: true,
      description: 'The user name',
      content: [{ kind: 'static', value: 'Ada' }],
    },
    'p/panel#0/image#0': {
      id: 'p/panel#0/image#0',
      kind: 'image',
      element: 'img',
      className: '',
      dynamicClassName: false,
      required: true,
      description: 'The avatar',
      content: [],
    },
    'p/panel#0/panel#0/badge#0': {
      id: 'p/panel#0/panel#0/badge#0',
      kind: 'badge',
      element: 'span',
      className: '',
      dynamicClassName: false,
      required: false,
      description: 'Online status',
      content: [{ kind: 'static', value: 'Online' }],
    },
  },
  palette: { seededFromAuthor: [], families: [] },
};

function req(prompt: string): GenerateRequest {
  return {
    prompt,
    panelId: 'p/panel#0',
    palette: schema.palette,
    ...panelSlice(schema, 'p/panel#0'),
  };
}

describe('panelSlice', () => {
  it('collects the panel subtree (nested panels + all dots)', () => {
    const slice = panelSlice(schema, 'p/panel#0');
    expect(Object.keys(slice.panels).sort()).toEqual(['p/panel#0', 'p/panel#0/panel#0']);
    expect(Object.keys(slice.dots)).toHaveLength(3);
  });
});

describe('mockGenerator', () => {
  it('enlarges text and panels for "make it bigger"', () => {
    const o = mockGenerator(req('make it bigger'));
    expect(o['p/panel#0/text#0']?.className).toContain('text-xl');
    expect(o['p/panel#0']?.className).toContain('p-5');
  });

  it('darkens panels and lightens text for "dark mode"', () => {
    const o = mockGenerator(req('switch to dark mode'));
    expect(o['p/panel#0']?.className).toContain('bg-slate-900');
    expect(o['p/panel#0/text#0']?.className).toContain('text-slate-100');
  });

  it('hides a dot matched by description for "hide the avatar"', () => {
    const o = mockGenerator(req('hide the avatar'));
    expect(o['p/panel#0/image#0']?.hidden).toBe(true);
  });

  it('reveals a matched dot for "show online status"', () => {
    const o = mockGenerator(req('show online status'));
    expect(o['p/panel#0/panel#0/badge#0']?.hidden).toBe(false);
  });

  it('hides only the non-required dots for a declutter prompt', () => {
    const o = mockGenerator(req('remove all unnecessary things, show only the very required info'));
    // The author-marked essentials stay visible…
    expect(o['p/panel#0/text#0']?.hidden).toBeUndefined();
    expect(o['p/panel#0/image#0']?.hidden).toBeUndefined();
    // …while everything non-required is hidden.
    expect(o['p/panel#0/panel#0/badge#0']?.hidden).toBe(true);
  });
});

describe('generatePanelOverlay', () => {
  it('passes generator output through the guardrail', async () => {
    const { overlay, dropped } = await generatePanelOverlay(req('x'), () => ({
      'p/panel#0/text#0': { className: 'text-lg shadow-2xl' },
    }));
    expect(overlay['p/panel#0/text#0']?.className).toBe('text-lg');
    expect(dropped['p/panel#0/text#0']).toEqual(['shadow-2xl']);
  });

  it('drops patches for ids outside the target panel slice', async () => {
    const { overlay } = await generatePanelOverlay(req('x'), () => ({
      'p/panel#0/text#0': { className: 'text-lg' },
      'other/panel#0': { className: 'bg-red-500' },
    }));
    expect(overlay['p/panel#0/text#0']?.className).toBe('text-lg');
    expect(overlay['other/panel#0']).toBeUndefined();
  });
});

describe('openaiGenerator', () => {
  it('parses a Responses API function call into an overlay', () => {
    const overlay = parseOpenAIOverlay({
      output: [
        {
          type: 'function_call',
          name: 'emit_overlay',
          arguments: JSON.stringify({
            overlay: {
              'p/panel#0/text#0': {
                className: ' text-lg font-bold ',
                hidden: null,
                style: { opacity: 0.8, ignored: false },
              },
            },
          }),
        },
      ],
    });

    expect(overlay['p/panel#0/text#0']).toEqual({
      className: 'text-lg font-bold',
      style: { opacity: 0.8 },
    });
  });

  it('includes the whole-UI context in the request body when supplied', async () => {
    let captured: OpenAIRequestBody | undefined;
    const client: OpenAIClient = async (body) => {
      captured = body;
      return {
        output: [
          {
            type: 'function_call',
            name: 'emit_overlay',
            arguments: JSON.stringify({ patches: [] }),
          },
        ],
      };
    };

    await openaiGenerator({ client })({
      ...req('make it dark'),
      context: { panels: schema.panels, dots: schema.dots },
    });

    if (!captured) throw new Error('Expected a request body.');
    const input = JSON.parse(captured.input) as {
      context?: { panels: unknown[]; dots: unknown[] };
    };
    expect(input.context?.panels).toHaveLength(2);
    expect(input.context?.dots).toHaveLength(3);
  });

  it('retries once when generated classes are outside the guardrail', async () => {
    const bodies: OpenAIRequestBody[] = [];
    const client: OpenAIClient = async (body) => {
      bodies.push(body);
      return {
        output: [
          {
            type: 'function_call',
            name: 'emit_overlay',
            arguments: JSON.stringify({
              patches: [
                {
                  id: 'p/panel#0/text#0',
                  className: bodies.length === 1 ? 'text-lg shadow-xl' : 'text-xl',
                  hidden: null,
                },
              ],
            }),
          },
        ],
      };
    };

    const overlay = await openaiGenerator({ client, model: 'gpt-test' })(req('make it readable'));

    expect(overlay['p/panel#0/text#0']?.className).toBe('text-xl');
    expect(bodies).toHaveLength(2);
    expect(bodies[0]?.model).toBe('gpt-test');

    const retry = bodies[1];
    if (!retry) throw new Error('Expected a retry request.');
    const input = JSON.parse(retry.input) as { feedback?: string };
    expect(input.feedback).toContain('unsupported classes');
  });
});
