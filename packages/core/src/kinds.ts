/**
 * The closed vocabulary of authorable `dot.*` kinds and how each maps to an HTML
 * element. Adding a new authorable element means adding it here — one source of
 * truth for both the compiler (extraction) and the runtime (rendering).
 */

export const PANEL_KIND = 'panel' as const;
export type PanelKind = typeof PANEL_KIND;

/** Non-panel dot kinds. */
export const DOT_KINDS = ['text', 'button', 'input', 'image', 'badge'] as const;
export type DotKind = (typeof DOT_KINDS)[number];

export type AnyKind = PanelKind | DotKind;

/** Default HTML element for each kind when the author gives no tag override. */
export const DEFAULT_ELEMENT = {
  panel: 'div',
  text: 'p',
  button: 'button',
  input: 'input',
  image: 'img',
  badge: 'span',
} satisfies Record<AnyKind, string>;

/**
 * Tags a kind may render as via its `type` prop. Only kinds listed here treat
 * `type` as a tag selector; for others (e.g. input) `type` is a normal DOM prop.
 */
export const ALLOWED_ELEMENTS = {
  text: ['p', 'span', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'small'],
} satisfies Partial<Record<DotKind, readonly string[]>>;

/** Kinds rendered as void elements — they carry no children/content. */
export const VOID_KINDS = ['input', 'image'] as const;

export function isDotKind(value: string): value is DotKind {
  return (DOT_KINDS as readonly string[]).includes(value);
}
