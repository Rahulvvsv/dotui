export { createOverlayStore } from './store';
// Re-exported for consumers: typing the `saveSchema` argument without a direct @dotui/core dep.
export type { SchemaFile } from '@dotui/core';
export type {
  OverlayRecord,
  OverlayStore,
  SaveOverlayArgs,
  SavedVisualRecord,
  SaveVisualArgs,
  SchemaRecord,
} from './types';
