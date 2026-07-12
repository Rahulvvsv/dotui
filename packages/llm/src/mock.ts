import { mergeOverride } from '@dotui/core';
import type { DotNode, Overlay, PanelNode, StyleOverride } from '@dotui/core';
import type { GenerateRequest } from './types';

const COLORS = [
  'slate',
  'gray',
  'red',
  'orange',
  'amber',
  'yellow',
  'green',
  'emerald',
  'teal',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
];
const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'all',
  'my',
  'to',
  'of',
  'this',
  'that',
  'please',
  'make',
  'set',
  'and',
  'section',
]);

/**
 * A deterministic, keyword-driven stand-in for an LLM. Scans the panel's schema slice
 * and emits guardrail-friendly overrides for recognised intents (size, dark, contrast,
 * colour, rounding, spacing) plus hide/show by matching words against dot text. Same
 * `Generator` signature an OpenAI-backed generator will implement.
 */
export function mockGenerator(req: GenerateRequest): Overlay {
  const p = req.prompt.toLowerCase();
  const overlay: Overlay = {};
  const dots = Object.values(req.dots);
  const panels = Object.values(req.panels);

  const add = (id: string, override: StyleOverride) => {
    overlay[id] = mergeOverride(overlay[id] ?? {}, override);
  };

  if (/\b(bigger|larger|large|big|huge|elderly|senior)\b/.test(p)) {
    for (const d of dots) {
      if (d.kind === 'text') add(d.id, { className: 'text-xl' });
      if (d.kind === 'button') add(d.id, { className: 'text-lg px-4 py-2.5' });
    }
    for (const pl of panels) add(pl.id, { className: 'gap-4 p-5' });
  }
  if (/\b(smaller|compact|dense|tight|tiny)\b/.test(p)) {
    for (const d of dots) if (d.kind === 'text') add(d.id, { className: 'text-xs' });
    for (const pl of panels) add(pl.id, { className: 'gap-1 p-2' });
  }
  if (/\b(dark|night)\b/.test(p)) {
    for (const pl of panels) add(pl.id, { className: 'bg-slate-900 border-slate-700' });
    for (const d of dots) if (d.kind === 'text') add(d.id, { className: 'text-slate-100' });
  }
  if (/\b(contrast|accessible|readable)\b/.test(p)) {
    for (const d of dots) if (d.kind === 'text') add(d.id, { className: 'text-black font-bold' });
    for (const pl of panels) add(pl.id, { className: 'bg-white border-black' });
  }
  const color = COLORS.find((c) => new RegExp(`\\b${c}\\b`).test(p));
  if (color) {
    for (const d of dots) {
      if (d.kind === 'button' || d.kind === 'badge')
        add(d.id, { className: `bg-${color}-600 text-white` });
      if (d.kind === 'text') add(d.id, { className: `text-${color}-700` });
    }
  }
  if (/\b(round|rounded|pill)\b/.test(p)) {
    for (const d of dots)
      if (d.kind === 'button' || d.kind === 'badge') add(d.id, { className: 'rounded-full' });
    for (const pl of panels) add(pl.id, { className: 'rounded-xl' });
  }
  if (/\b(spacious|airy|roomy|breathing)\b/.test(p)) {
    for (const pl of panels) add(pl.id, { className: 'p-6 gap-6' });
  }
  if (wantsEssentials(p)) {
    // "Show only what I need" → hide every dot the author didn't mark `required`,
    // collapsing the superset down to its essentials. Panels (structure) are kept.
    for (const d of dots) if (!d.required) add(d.id, { hidden: true });
  }

  applyVisibility(p, dots, panels, add);
  return overlay;
}

/** True when the prompt asks to declutter down to the essentials / only required info. */
function wantsEssentials(p: string): boolean {
  if (/\b(essentials?|unnecessary|declutter|minimal|minimalist|simplify|tidy)\b/.test(p)) {
    return true;
  }
  return /\bonly\b[^.]*\b(required|important|needed|need|essential|necessary)\b/.test(p);
}

/** Hide/show dots & panels whose text matches the words after a hide/show verb. */
function applyVisibility(
  prompt: string,
  dots: DotNode[],
  panels: PanelNode[],
  add: (id: string, o: StyleOverride) => void,
) {
  const nodes: Array<DotNode | PanelNode> = [...dots, ...panels];
  const hide = prompt.match(/\b(?:hide|remove|without|drop)\b\s+(.+)/);
  const show = prompt.match(/\b(?:show|reveal|display|bring back)\b\s+(.+)/);
  if (hide) for (const id of match(hide[1] ?? '', nodes)) add(id, { hidden: true });
  if (show) for (const id of match(show[1] ?? '', nodes)) add(id, { hidden: false });
}

function match(phrase: string, nodes: Array<DotNode | PanelNode>): string[] {
  const words = phrase
    .split(/\W+/)
    .map((w) => w.replace(/s$/, '')) // crude singularisation: images -> image
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (words.length === 0) return [];
  return nodes.filter((n) => words.some((w) => nodeText(n).includes(w))).map((n) => n.id);
}

function nodeText(node: DotNode | PanelNode): string {
  const parts = [node.kind, node.description ?? ''];
  if ('content' in node) {
    for (const part of node.content) parts.push(part.kind === 'static' ? part.value : part.expr);
  }
  return parts.join(' ').toLowerCase();
}
