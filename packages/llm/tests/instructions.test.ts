import { describe, expect, it } from 'vitest';
import type { GenerateRequest, OpenAIClient, OpenAIRequestBody } from '../src';
import { openaiGenerator } from '../src/openai';

describe('openaiGenerator instructions', () => {
  it('tells the model a repeated node styles every instance', async () => {
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

    const request: GenerateRequest = { prompt: 'dark', panelId: 'p/panel#0', panels: {}, dots: {} };
    await openaiGenerator({ client })(request);

    if (!captured) throw new Error('Expected a request body.');
    expect(captured.instructions).toContain('repeated');
    expect(captured.instructions).toContain('every instance');
  });
});
