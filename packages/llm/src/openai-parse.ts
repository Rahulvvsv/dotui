import type { Overlay, StyleOverride } from '@dotui/core';

export const TOOL_NAME = 'emit_overlay';

export function parseOpenAIOverlay(response: unknown): Overlay {
  const args = findToolArguments(response);
  const parsed = parseJson(args, 'tool arguments');
  return normalizeOverlay(parsed);
}

function findToolArguments(response: unknown): string {
  const root = requireRecord(response, 'OpenAI response');
  const output = root.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (!isRecord(item) || item.type !== 'function_call' || item.name !== TOOL_NAME) continue;
      if (typeof item.arguments === 'string') return item.arguments;
    }
  }

  const choices = root.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!isRecord(choice) || !isRecord(choice.message)) continue;
      const calls = choice.message.tool_calls;
      if (!Array.isArray(calls)) continue;
      for (const call of calls) {
        if (!isRecord(call) || !isRecord(call.function)) continue;
        if (call.function.name === TOOL_NAME && typeof call.function.arguments === 'string') {
          return call.function.arguments;
        }
      }
    }
  }

  throw new Error(`No ${TOOL_NAME} tool call found.`);
}

function normalizeOverlay(value: unknown): Overlay {
  const root = requireRecord(value, 'overlay payload');
  if (Array.isArray(root.patches)) return normalizePatches(root.patches);
  const source = isRecord(root.overlay) ? root.overlay : root;
  const overlay: Overlay = {};

  for (const [id, raw] of Object.entries(source)) {
    if (!id.trim()) throw new Error('Overlay contains a blank id.');
    const override = requireRecord(raw, `override for ${id}`);
    const next: StyleOverride = {};

    if (typeof override.className === 'string' && override.className.trim()) {
      next.className = override.className.trim();
    }
    if (typeof override.hidden === 'boolean') next.hidden = override.hidden;
    if (isRecord(override.style)) {
      const style: Record<string, string | number> = {};
      for (const [key, styleValue] of Object.entries(override.style)) {
        if (typeof styleValue === 'string' || typeof styleValue === 'number') {
          style[key] = styleValue;
        }
      }
      if (Object.keys(style).length > 0) next.style = style;
    }

    if (Object.keys(next).length > 0) overlay[id] = next;
  }

  return overlay;
}

function normalizePatches(patches: unknown[]): Overlay {
  const overlay: Overlay = {};

  for (const raw of patches) {
    const patch = requireRecord(raw, 'overlay patch');
    const id = typeof patch.id === 'string' ? patch.id : undefined;
    if (!id?.trim()) throw new Error('Overlay patch is missing an id.');

    const next: StyleOverride = {};
    if (typeof patch.className === 'string' && patch.className.trim()) {
      next.className = patch.className.trim();
    }
    if (typeof patch.hidden === 'boolean') next.hidden = patch.hidden;
    if (Object.keys(next).length > 0) overlay[id] = next;
  }

  return overlay;
}

function parseJson(value: string, label: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`Invalid JSON in ${label}.`);
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (isRecord(value)) return value;
  throw new Error(`${label} must be an object.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
