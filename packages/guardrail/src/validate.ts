import { ALLOWED_FAMILIES, type Overlay } from '@dotui/core';
import { classifyClass } from './classify';

const ALLOWED = new Set<string>(ALLOWED_FAMILIES);

export type ClassCheck = { className: string; dropped: string[] };

/** Keep only utilities whose family is allowed; report the rest as dropped. */
export function validateClassName(className: string): ClassCheck {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const token of className.split(/\s+/).filter(Boolean)) {
    const family = classifyClass(token);
    if (family && ALLOWED.has(family)) kept.push(token);
    else dropped.push(token);
  }
  return { className: kept.join(' '), dropped };
}

export type OverlayCheck = { overlay: Overlay; dropped: Record<string, string[]> };

/**
 * Strip out-of-rail classes from every override in an overlay. `style` and `hidden`
 * pass through untouched (visibility is always allowed; style is not class-validated).
 * Returns the cleaned overlay plus, per dot id, the classes that were rejected.
 */
export function validateOverlay(overlay: Overlay): OverlayCheck {
  const clean: Overlay = {};
  const dropped: Record<string, string[]> = {};
  for (const [id, override] of Object.entries(overlay)) {
    const next = { ...override };
    if (override.className !== undefined) {
      const check = validateClassName(override.className);
      next.className = check.className;
      if (check.dropped.length > 0) dropped[id] = check.dropped;
    }
    clean[id] = next;
  }
  return { overlay: clean, dropped };
}
