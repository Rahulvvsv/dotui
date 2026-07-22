import type { Overlay } from '@dotui/core';
import type { ReactNode } from 'react';

/** What a generate call returns: the overlay to apply, plus any guardrail drops. */
export type PromptResult = { overlay: Overlay; dropped?: Record<string, string[]> };

/**
 * A named, whole-UI snapshot of the live overlay — a "saved visual" the user can switch
 * back to. `id` is assigned by the persistence layer (e.g. a DB row id); for purely
 * in-memory use the provider falls back to a timestamp.
 */
export type SavedVisual = {
  id: string | number;
  name: string;
  overlay: Overlay;
  createdAt?: string;
};

/**
 * The app-supplied bridge to the generation pipeline. The app wires the schema slice +
 * generator + guardrail (e.g. `@dotui/llm`'s `generatePanelOverlay`) behind this — the
 * prompt UI stays decoupled from how overlays are produced (mock now, OpenAI later).
 */
export type GenerateFn = (args: {
  prompt: string;
  panelId: string;
  current?: Overlay;
}) => Promise<PromptResult>;

export type DotuiPromptProviderProps = {
  generate: GenerateFn;
  initialOverlay?: Overlay;
  /**
   * Optional callback fired after a prompt has been applied, with the full live overlay.
   * Apply-only by default (in-memory); supply this to persist the look (e.g. POST to a
   * store-backed endpoint) so it survives a reload. Runs once per run — after the single
   * panel for `<Promptable>`, or after the last panel of a global run.
   */
  onApplied?: (overlay: Overlay) => void | Promise<void>;
  /**
   * Saved visuals to seed the switcher with on mount (e.g. read from a store on the
   * server and passed down). The provider keeps its own list in state from here on.
   */
  savedVisuals?: SavedVisual[];
  /**
   * Persist a named snapshot of the current overlay. Return the stored record (with its
   * real id) to have the switcher use it; return nothing to keep the save in-memory only.
   */
  onSaveVisual?: (visual: {
    name: string;
    overlay: Overlay;
  }) => SavedVisual | undefined | Promise<SavedVisual | undefined>;
  /**
   * Persist the removal of a saved visual (e.g. DELETE to a store-backed endpoint).
   * Omit to keep deletion in-memory only. The live overlay is never touched by a delete.
   */
  onDeleteVisual?: (visual: SavedVisual) => void | Promise<void>;
  children: ReactNode;
};

export type PromptableProps = {
  panelId: string;
  children: ReactNode;
  className?: string;
  /**
   * Show the inline  control (default true). Set false to register the panel for the
   * global prompt without an inline button — e.g. a full-bleed background/root panel that
   * should follow a global "dark mode" prompt but doesn't need its own corner affordance.
   */
  showControl?: boolean;
};

export type PromptContextValue = {
  editMode: boolean;
  busy: boolean;
  /** The panel the generator is currently working on, so it can be highlighted. */
  activePanelId: string | null;
  runPanel: (panelId: string, prompt: string) => void;
  /** Return one panel (its id + all descendant ids) to the page-load look. */
  resetPanel: (panelId: string) => void;
  register: (panelId: string) => void;
  unregister: (panelId: string) => void;
};
