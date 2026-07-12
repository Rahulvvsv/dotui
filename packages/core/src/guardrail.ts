/**
 * Tailwind utility families the LLM is allowed to emit. The actual class-by-class
 * validation lives in the guardrail/validator layer; this is the shared vocabulary
 * that the extracted schema advertises to the model.
 */

export const ALLOWED_FAMILIES = [
  'text-size',
  'font-weight',
  'text-color',
  'bg-color',
  'padding',
  'margin',
  'gap',
  'rounded',
  'border',
  'border-color',
  'display',
  'flex',
  'grid',
  'align',
  'justify',
  'width',
  'height',
] as const;

export type AllowedFamily = (typeof ALLOWED_FAMILIES)[number];
