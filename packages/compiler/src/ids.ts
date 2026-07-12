/**
 * Deterministic id generation. An id is the element's structural path through the
 * source: <scope>/<ancestorSegments>/<kind>#<siblingIndex>. The same scheme runs at
 * build time (here) and, later, in the Babel stamping plugin, so runtime ids match.
 */

/** `#` = static sibling index; `~` = expression-nested (template/conditional) index. */
export function makeSegment(kind: string, index: number, marker: '#' | '~' = '#'): string {
  return `${kind}${marker}${index}`;
}

export function makeId(scope: string, parents: string[], segment: string): string {
  return [scope, ...parents, segment].join('/');
}

/** Scope prefix derived from the file name, e.g. "home.panel.tsx" -> "home". */
export function scopeFromFile(filePath: string): string {
  const base = filePath.replace(/\\/g, '/').split('/').pop() ?? 'panel';
  return base.replace(/\.panel\.[tj]sx?$/i, '').replace(/\.[tj]sx?$/i, '');
}
