import type { DotNode, PanelNode, SchemaFile } from '@dotui/core';

export type PanelSlice = {
  panels: Record<string, PanelNode>;
  dots: Record<string, DotNode>;
};

/**
 * The subtree rooted at `panelId`: that panel, every nested panel, and every dot
 * beneath them. This is the focused context handed to a generator for one panel.
 */
export function panelSlice(schema: SchemaFile, panelId: string): PanelSlice {
  const panels: Record<string, PanelNode> = {};
  const dots: Record<string, DotNode> = {};
  const queue = [panelId];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    const panel = schema.panels[id];
    if (!panel || panels[id]) continue;
    panels[id] = panel;
    for (const childId of panel.children) {
      if (schema.panels[childId]) queue.push(childId);
      else if (schema.dots[childId]) dots[childId] = schema.dots[childId];
    }
  }

  return { panels, dots };
}
