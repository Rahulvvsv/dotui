import type { DotNode, Overlay, Palette, PanelNode } from '@dotui/core';

/**
 * The whole authored UI as read-only context: every panel and dot in the schema. A
 * generator may only *edit* the target panel (`panels`/`dots`), but seeing the rest of
 * the UI lets it keep a global prompt (e.g. "dark mode") coherent across panels.
 */
export type UIContext = {
  panels: Record<string, PanelNode>;
  dots: Record<string, DotNode>;
};

/**
 * Everything a generator needs to restyle one panel: the user's prompt, the panel's
 * schema slice (the panel + its descendant panels and dots — the *editable* target),
 * optional whole-UI `context` for cross-panel coherence, and the current overlay (the
 * styling decided so far, including earlier panels in a global run). This is the seam —
 * `mockGenerator` today, an OpenAI-backed one in the demo.
 */
export type GenerateRequest = {
  prompt: string;
  panelId: string;
  panels: Record<string, PanelNode>;
  dots: Record<string, DotNode>;
  palette?: Palette;
  context?: UIContext;
  current?: Overlay;
};

/** Turns a request into an overlay (subset for this panel). Sync or async. */
export type Generator = (req: GenerateRequest) => Overlay | Promise<Overlay>;

/** A generated overlay after guardrail validation, plus any classes that were dropped. */
export type GenerateResult = { overlay: Overlay; dropped: Record<string, string[]> };
