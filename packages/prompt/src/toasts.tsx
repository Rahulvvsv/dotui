'use client';

import type { Toast } from './use-toasts';

/**
 * The prompt layer's notification stack. A polite live region so screen readers
 * announce failures and guardrail drops; each toast is a button — click to dismiss.
 */
export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <output className="dotui-toasts" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`dotui-toast dotui-toast--${toast.kind}`}
          onClick={() => onDismiss(toast.id)}
          aria-label={`Dismiss notification: ${toast.message}`}
        >
          {toast.message}
        </button>
      ))}
    </output>
  );
}
