/**
 * The LLM's output (and what we persist): a per-dot styling override, keyed by the
 * dot's structural id. Kept React-free here so server/storage code can depend on it;
 * `style` is a plain object that the runtime widens to React's CSSProperties.
 */

export type StyleOverride = {
  className?: string;
  style?: Record<string, string | number>;
  /** When true the dot renders nothing (a hidden panel drops its whole subtree). */
  hidden?: boolean;
};

/** Map of dot id -> override. The styling for one panel, or merged for an app. */
export type Overlay = Record<string, StyleOverride>;
