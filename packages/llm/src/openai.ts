import { ALLOWED_FAMILIES } from '@dotui/core';
import type { Overlay } from '@dotui/core';
import { validateOverlay } from '@dotui/guardrail';
import { TOOL_NAME, parseOpenAIOverlay } from './openai-parse';
import type { GenerateRequest, Generator } from './types';

const DEFAULT_MODEL = 'gpt-5.4-mini';
const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/responses';
export type OpenAIRequestBody = {
  model: string;
  instructions: string;
  input: string;
  tools: unknown[];
  tool_choice: { type: 'function'; name: string };
  parallel_tool_calls: false;
  store: false;
  max_output_tokens: number;
};

export type OpenAIClient = (body: OpenAIRequestBody) => Promise<unknown>;

export type OpenAIGeneratorOptions = {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  client?: OpenAIClient;
  maxOutputTokens?: number;
  retryCount?: number;
};

export function openaiGenerator(options: OpenAIGeneratorOptions = {}): Generator {
  const model = options.model ?? DEFAULT_MODEL;
  const maxOutputTokens = options.maxOutputTokens ?? 4000;
  const attempts = (options.retryCount ?? 1) + 1;
  const client =
    options.client ?? createFetchClient(options.apiKey, options.endpoint ?? DEFAULT_ENDPOINT);

  return async (req) => {
    let feedback: string | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const body = createBody(req, model, maxOutputTokens, feedback);
        const response = await client(body);
        const overlay = parseOpenAIOverlay(response);
        const { dropped } = validateOverlay(overlay);
        if (Object.keys(dropped).length === 0 || attempt === attempts - 1) return overlay;
        feedback = `Retry: unsupported classes were dropped (${formatDropped(dropped)}). Use only the allowed Tailwind families.`;
      } catch (error) {
        lastError = error;
        feedback = `Retry: the previous response was invalid (${messageOf(error)}). Call ${TOOL_NAME} with valid arguments only.`;
      }
    }

    throw new Error(`OpenAI generator failed: ${messageOf(lastError)}`);
  };
}

function createFetchClient(apiKey: string | undefined, endpoint: string): OpenAIClient {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for openaiGenerator.');
  return async (body) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<unknown>;
  };
}

function createBody(
  req: GenerateRequest,
  model: string,
  maxOutputTokens: number,
  feedback?: string,
): OpenAIRequestBody {
  return {
    model,
    instructions: [
      'You generate dotUI style overlays for existing JSX-authored UI.',
      `Call the ${TOOL_NAME} function exactly once.`,
      'You are editing ONLY the target panel: emit patches solely for ids in `panels`/`dots`.',
      'The `context` field is the rest of the UI, read-only — never emit patches for its ids.',
      'Each panel/dot `className` shown is the CURRENT live look — the authored classes with',
      "the user's and your earlier edits already folded in (and `hidden` is the live state).",
      'Build your changes ON TOP of this current look; never reset to the original authored',
      'styling or undo edits the user already made unless the prompt explicitly asks for it.',
      'Use `context` to stay consistent with the rest of the UI (e.g. match the palette and',
      'spacing of panels already styled). Never invent ids or structure.',
      'Do not hide required dots. Use hidden:false to reveal authored elements.',
      'Nodes with repeated:true are templates rendered many times (list cards); a patch on such an id restyles every instance.',
      'Use Tailwind utility classes only from the allowed families or classes seeded by the author.',
      'Return sparse patches containing only changes needed for the user prompt.',
    ].join(' '),
    input: JSON.stringify(inputContext(req, feedback)),
    tools: [emitOverlayTool()],
    tool_choice: { type: 'function', name: TOOL_NAME },
    parallel_tool_calls: false,
    store: false,
    max_output_tokens: maxOutputTokens,
  };
}

function inputContext(req: GenerateRequest, feedback?: string) {
  const current = req.current ?? {};
  return {
    prompt: req.prompt,
    panelId: req.panelId,
    feedback,
    palette: req.palette ?? { families: ALLOWED_FAMILIES, seededFromAuthor: [] },
    panels: Object.values(req.panels).map((node) => withCurrent(node, current)),
    dots: Object.values(req.dots).map((node) => withCurrent(node, current)),
    context: req.context
      ? { panels: Object.values(req.context.panels), dots: Object.values(req.context.dots) }
      : undefined,
  };
}

/**
 * Fold the current overlay into a node so the model sees the LIVE look, not just the
 * authored baseline: `className` becomes authored + overlay (later wins at render, so we
 * just append), and `hidden` reflects whatever the overlay set. This is what makes the
 * model edit on top of the user's accumulated changes instead of the "first version".
 */
function withCurrent<T extends { id: string; className: string }>(
  node: T,
  current: Overlay,
): T & { hidden?: boolean } {
  const override = current[node.id];
  if (!override) return node;
  const className = [node.className, override.className].filter(Boolean).join(' ');
  return { ...node, className, ...(override.hidden !== undefined && { hidden: override.hidden }) };
}

function emitOverlayTool() {
  return {
    type: 'function',
    name: TOOL_NAME,
    description: 'Emit a dotUI style overlay keyed by existing panel or dot id.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        patches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              className: { type: ['string', 'null'] },
              hidden: { type: ['boolean', 'null'] },
            },
            required: ['id', 'className', 'hidden'],
            additionalProperties: false,
          },
        },
      },
      required: ['patches'],
      additionalProperties: false,
    },
  };
}

function formatDropped(dropped: Record<string, string[]>): string {
  return Object.entries(dropped)
    .map(([id, classes]) => `${id}: ${classes.join(' ')}`)
    .join('; ');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
