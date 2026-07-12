import type { Overlay } from '@dotui/core';
import { validateOverlay } from '@dotui/guardrail';
import type { GenerateRequest, GenerateResult, Generator } from './types';

/**
 * Run a generator for one panel, scope its output to that panel's ids, then pass it
 * through the guardrail so any out-of-rail classes are stripped before the overlay is
 * applied. This is the single entry point the prompt UI calls — swapping the generator
 * never changes this contract.
 *
 * Scoping to `req.panels`/`req.dots` keeps "edit one panel at a time" honest: even when
 * the generator is given the whole UI as `context`, it can only emit patches for the
 * target panel, so panels in a sequential global run never stomp one another.
 */
export async function generatePanelOverlay(
  req: GenerateRequest,
  generator: Generator,
): Promise<GenerateResult> {
  const raw = await generator(req);
  return validateOverlay(scopeToPanel(raw, req));
}

function scopeToPanel(overlay: Overlay, req: GenerateRequest): Overlay {
  const allowed = new Set([...Object.keys(req.panels), ...Object.keys(req.dots)]);
  const scoped: Overlay = {};
  for (const [id, override] of Object.entries(overlay)) {
    if (allowed.has(id)) scoped[id] = override;
  }
  return scoped;
}
