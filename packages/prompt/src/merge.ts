/**
 * Patch-layering semantics live in @dotui/core (one definition for the whole
 * system); re-exported here because this package's consumers and tests reach it
 * as part of the prompt API.
 */

export { mergeOverlay } from '@dotui/core';
