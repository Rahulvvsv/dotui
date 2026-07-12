import type { AllowedFamily } from '@dotui/core';

const TEXT_SIZES = new Set([
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
]);
const FONT_WEIGHTS = new Set([
  'thin',
  'extralight',
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
  'extrabold',
  'black',
]);
// Bare display keywords (note: `flex`/`grid` are display values AND family heads).
const DISPLAY = new Set([
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'table',
  'grid',
  'inline-grid',
  'contents',
  'hidden',
  'flow-root',
  'list-item',
]);
const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'double', 'none', 'hidden']);
const SIDES = new Set(['x', 'y', 't', 'r', 'b', 'l']);

/** A color suffix: `red-500`, `slate-900`, or the bare keywords white/black/transparent/current/inherit. */
function isColor(rest: string): boolean {
  return /^(?:[a-z]+-\d{1,3}|white|black|transparent|current|inherit)$/.test(rest);
}

/**
 * Classify a single Tailwind utility into an allowed family, or null if it's
 * outside the vocabulary. Variant prefixes (`hover:`, `md:`, `dark:`…) and a
 * leading negative (`-mt-2`) are stripped before classifying.
 */
export function classifyClass(token: string): AllowedFamily | null {
  const noVariant = token.includes(':') ? token.slice(token.lastIndexOf(':') + 1) : token;
  const cls = noVariant.startsWith('-') ? noVariant.slice(1) : noVariant;
  if (!cls) return null;

  if (DISPLAY.has(cls)) return 'display';

  const dash = cls.indexOf('-');
  const head = dash === -1 ? cls : cls.slice(0, dash);
  const rest = dash === -1 ? '' : cls.slice(dash + 1);

  switch (head) {
    case 'text':
      if (TEXT_SIZES.has(rest)) return 'text-size';
      return isColor(rest) ? 'text-color' : null;
    case 'font':
      return FONT_WEIGHTS.has(rest) ? 'font-weight' : null;
    case 'bg':
      return isColor(rest) ? 'bg-color' : null;
    case 'p':
    case 'px':
    case 'py':
    case 'pt':
    case 'pr':
    case 'pb':
    case 'pl':
      return 'padding';
    case 'm':
    case 'mx':
    case 'my':
    case 'mt':
    case 'mr':
    case 'mb':
    case 'ml':
      return 'margin';
    case 'gap':
      return 'gap';
    case 'rounded':
      return 'rounded';
    case 'w':
      return 'width';
    case 'h':
      return 'height';
    case 'items':
    case 'self':
    case 'content':
    case 'place':
      return 'align';
    case 'justify':
      return 'justify';
    case 'flex':
    case 'grow':
    case 'shrink':
    case 'basis':
    case 'order':
      return 'flex';
    case 'grid':
    case 'col':
    case 'row':
    case 'auto':
      return 'grid';
    case 'border':
      return classifyBorder(rest);
    default:
      return null;
  }
}

function classifyBorder(rest: string): AllowedFamily {
  if (rest === '' || BORDER_STYLES.has(rest) || /^\d+$/.test(rest)) return 'border';
  const seg = rest.split('-')[0] ?? '';
  if (SIDES.has(seg)) return 'border'; // border-x, border-t-2, …
  return isColor(rest) ? 'border-color' : 'border';
}
