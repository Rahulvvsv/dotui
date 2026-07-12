import type { Overlay, StyleOverride } from '@dotui/core';
import { type ReactNode, createContext, useContext } from 'react';

const OverlayContext = createContext<Overlay>({});

/** Supplies the generated style overlay to every `dot.*` beneath it. */
export function DotOverlayProvider({
  value,
  children,
}: {
  value: Overlay;
  children: ReactNode;
}) {
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

/** A dot reads its own override by its stamped id (undefined until generated). */
export function useOverlay(dotId?: string): StyleOverride | undefined {
  const overlay = useContext(OverlayContext);
  return dotId ? overlay[dotId] : undefined;
}
