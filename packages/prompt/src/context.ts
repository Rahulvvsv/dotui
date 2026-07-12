import { createContext, useContext } from 'react';
import type { PromptContextValue } from './types';

export const PromptContext = createContext<PromptContextValue | null>(null);

/** Read the prompt context (edit mode, busy, run a panel). Throws outside the provider. */
export function usePrompt(): PromptContextValue {
  const ctx = useContext(PromptContext);
  if (!ctx) throw new Error('usePrompt must be used within <DotuiPromptProvider>.');
  return ctx;
}
