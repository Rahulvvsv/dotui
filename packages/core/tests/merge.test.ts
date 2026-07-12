import { describe, expect, it } from 'vitest';
import { mergeOverlay, mergeOverride } from '../src/merge';

describe('mergeOverride', () => {
  it('accumulates classes and lets the patch win on hidden and style', () => {
    const merged = mergeOverride(
      { className: 'p-2', hidden: true, style: { color: 'red', margin: 1 } },
      { className: 'bg-red-500', hidden: false, style: { color: 'blue' } },
    );
    expect(merged.className).toBe('p-2 bg-red-500');
    expect(merged.hidden).toBe(false);
    expect(merged.style).toEqual({ color: 'blue', margin: 1 });
  });

  it('keeps prev.hidden when the patch does not mention it', () => {
    expect(mergeOverride({ hidden: true }, { className: 'p-2' }).hidden).toBe(true);
  });

  it('leaves style undefined when neither side has one', () => {
    expect(mergeOverride({ className: 'a' }, { className: 'b' }).style).toBeUndefined();
  });
});

describe('mergeOverlay', () => {
  it('merges per id and keeps untouched ids', () => {
    const next = mergeOverlay(
      { a: { className: 'p-2' }, b: { hidden: true } },
      { a: { className: 'bg-red-500' } },
    );
    expect(next.a?.className).toBe('p-2 bg-red-500');
    expect(next.b?.hidden).toBe(true);
  });
});
