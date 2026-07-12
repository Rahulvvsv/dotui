/**
 * The one place "layer a patch onto an override" is defined. Semantics:
 * classes ACCUMULATE (the runtime's tailwind-merge resolves conflicts, so the
 * later class wins on screen); `style` keys and `hidden` from the patch take
 * precedence. Successive prompts therefore stack rather than replace.
 */

import type { Overlay, StyleOverride } from './types/overlay';

export function mergeOverride(prev: StyleOverride, patch: StyleOverride): StyleOverride {
  return {
    ...prev,
    ...patch,
    className: [prev.className, patch.className].filter(Boolean).join(' ') || undefined,
    style: prev.style || patch.style ? { ...prev.style, ...patch.style } : undefined,
    hidden: patch.hidden ?? prev.hidden,
  };
}

/** Apply `mergeOverride` per dot id; ids missing from the patch pass through. */
export function mergeOverlay(base: Overlay, patch: Overlay): Overlay {
  const next: Overlay = { ...base };
  for (const [id, override] of Object.entries(patch)) {
    next[id] = mergeOverride(next[id] ?? {}, override);
  }
  return next;
}
