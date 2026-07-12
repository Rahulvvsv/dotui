/**
 * The schema file produced by `dotui build` and consumed by the LLM. It is a
 * static, serializable description of every addressable dot/panel in the app:
 * structure, element tags, the developer's baseline classes, and which content
 * is static text versus a dynamic React expression.
 */

import type { DotKind } from '../kinds';

/** A piece of a dot's children: literal text, or an opaque dynamic expression. */
export type ContentPart = { kind: 'static'; value: string } | { kind: 'dynamic'; expr: string };

/** A non-panel addressable element (e.g. a text node). */
export type DotNode = {
  id: string;
  kind: DotKind;
  element: string;
  /** The developer's baseline Tailwind classes (static portion only). */
  className: string;
  /** True when className came from a non-static expression we could not read. */
  dynamicClassName: boolean;
  /** Whether the dot is essential — a hint the LLM must not hide/de-emphasise it. */
  required: boolean;
  /** Author's note to the LLM about what this dot is for. */
  description?: string;
  /** Present when this element renders N times from one source position (a `.map()`
   *  callback); a style override on its id applies to every instance. */
  repeated?: true;
  content: ContentPart[];
};

/** A container element; holds ordered child dot/panel ids. */
export type PanelNode = {
  id: string;
  kind: 'panel';
  element: string;
  className: string;
  dynamicClassName: boolean;
  /** Author's note to the LLM about what this panel is for. */
  description?: string;
  /** Present when this element renders N times from one source position (a `.map()`
   *  callback); a style override on its id applies to every instance. */
  repeated?: true;
  children: string[];
};

/** The palette/rails handed to the LLM. */
export type Palette = {
  /** Exact classes the developer already used — always reusable by the model. */
  seededFromAuthor: string[];
  /** Allowed Tailwind families the model may draw from. */
  families: string[];
};

export type SchemaFile = {
  version: number;
  panels: Record<string, PanelNode>;
  dots: Record<string, DotNode>;
  palette: Palette;
};
