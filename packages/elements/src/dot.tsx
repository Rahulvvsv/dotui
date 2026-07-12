/**
 * The `dot.*` namespace: thin React components that render real HTML and merge the
 * LLM's style overlay onto the developer's own className/style. What you write is
 * what renders; the overlay only augments it (override wins on conflicting classes).
 *
 * Every kind comes from the same factory. Only two things ever vary:
 * - void elements (input, img) render no children;
 * - for dot.text the `type` prop selects the rendered tag (h1, span, …) — for every
 *   other kind `type` is an ordinary DOM prop (e.g. <dot.input type="email">).
 */

import type { CSSProperties, ComponentPropsWithRef, ElementType, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { useOverlay } from './overlay';

/**
 * dotUI authoring metadata. `__dotId` is stamped by the build-time plugin;
 * `description`/`required` are read by `dotui build` for the LLM. None of these
 * are real DOM attributes, so the factory strips them before rendering.
 */
type DotMeta = { __dotId?: string; description?: string; required?: boolean };
// ComponentPropsWithRef so `ref` and every native event/attribute (onClick, onChange,
// onMouseEnter, disabled, aria-*, data-*, ...) flow straight through to the element.
type DotProps<T extends ElementType> = ComponentPropsWithRef<T> & DotMeta;

type TextTag =
  | 'p'
  | 'span'
  | 'label'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'strong'
  | 'em'
  | 'small';

/**
 * Read the dot's overlay: `hidden` (the dot renders nothing) plus the merged
 * author/override className & style (override wins on conflicts).
 */
function useMerged(dotId: string | undefined, className?: string, style?: CSSProperties) {
  const override = useOverlay(dotId);
  return {
    hidden: override?.hidden ?? false,
    className: twMerge(className, override?.className),
    style: { ...style, ...(override?.style as CSSProperties | undefined) },
  };
}

type FactoryOptions = {
  /** Void element (input, img): render no children. */
  isVoid?: boolean;
  /** dot.text only: `type` selects the rendered tag instead of reaching the DOM. */
  typeIsTag?: boolean;
};

type AnyDotProps = DotMeta & {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Record<string, unknown>;

/** Build one dot component: strip dotUI metadata, merge the overlay, render. */
function createDot(defaultElement: ElementType, options: FactoryOptions = {}) {
  function Dot(props: AnyDotProps) {
    const { __dotId, description, required, className, style, children, ...rest } = props;
    const { hidden, ...merged } = useMerged(__dotId, className, style);
    if (hidden) return null;

    let Tag = defaultElement;
    let domProps: Record<string, unknown> = rest;
    if (options.typeIsTag) {
      const { type, ...withoutType } = rest;
      if (typeof type === 'string') Tag = type as ElementType;
      domProps = withoutType;
    }

    if (options.isVoid) return <Tag {...domProps} {...merged} />;
    return (
      <Tag {...domProps} {...merged}>
        {children}
      </Tag>
    );
  }
  return Dot;
}

export const dot: {
  panel: (props: DotProps<'div'>) => ReactNode;
  text: (props: Omit<DotProps<'p'>, 'type'> & { type?: TextTag }) => ReactNode;
  button: (props: DotProps<'button'>) => ReactNode;
  badge: (props: DotProps<'span'>) => ReactNode;
  input: (props: DotProps<'input'>) => ReactNode;
  image: (props: DotProps<'img'>) => ReactNode;
} = {
  panel: createDot('div') as (props: DotProps<'div'>) => ReactNode,
  text: createDot('p', { typeIsTag: true }) as (
    props: Omit<DotProps<'p'>, 'type'> & { type?: TextTag },
  ) => ReactNode,
  button: createDot('button') as (props: DotProps<'button'>) => ReactNode,
  badge: createDot('span') as (props: DotProps<'span'>) => ReactNode,
  input: createDot('input', { isVoid: true }) as (props: DotProps<'input'>) => ReactNode,
  image: createDot('img', { isVoid: true }) as (props: DotProps<'img'>) => ReactNode,
};
