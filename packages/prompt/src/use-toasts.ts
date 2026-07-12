'use client';

import { useCallback, useRef, useState } from 'react';

export type ToastKind = 'error' | 'info';
export type Toast = { id: number; kind: ToastKind; message: string };

const AUTO_DISMISS_MS = 6000;
const MAX_VISIBLE = 4;

/**
 * Self-expiring notification queue for the prompt layer's own chrome: generation
 * failures, guardrail drops, and cancel confirmations. Newest last; capped.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, kind, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return { toasts, addToast, dismiss };
}
