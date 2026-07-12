import { createHash } from 'node:crypto';

/**
 * Deterministic SHA-256 of any JSON-serializable value. Object keys are sorted
 * recursively so that semantically-equal content always yields the same hash —
 * this is the dedup key for schema snapshots (re-saving identical content is a no-op).
 */
export function stableHash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
}
