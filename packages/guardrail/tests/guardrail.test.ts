import { describe, expect, it } from 'vitest';
import { classifyClass } from '../src/classify';
import { validateClassName, validateOverlay } from '../src/validate';

describe('classifyClass', () => {
  it('classifies utilities into allowed families', () => {
    expect(classifyClass('text-lg')).toBe('text-size');
    expect(classifyClass('text-slate-900')).toBe('text-color');
    expect(classifyClass('font-semibold')).toBe('font-weight');
    expect(classifyClass('bg-blue-600')).toBe('bg-color');
    expect(classifyClass('p-4')).toBe('padding');
    expect(classifyClass('-mt-2')).toBe('margin');
    expect(classifyClass('gap-x-4')).toBe('gap');
    expect(classifyClass('rounded-lg')).toBe('rounded');
    expect(classifyClass('border')).toBe('border');
    expect(classifyClass('border-slate-200')).toBe('border-color');
    expect(classifyClass('flex')).toBe('display');
    expect(classifyClass('flex-col')).toBe('flex');
    expect(classifyClass('items-center')).toBe('align');
    expect(classifyClass('justify-between')).toBe('justify');
    expect(classifyClass('w-16')).toBe('width');
    expect(classifyClass('hover:bg-red-500')).toBe('bg-color');
  });

  it('returns null for utilities outside the vocabulary', () => {
    expect(classifyClass('shadow-lg')).toBeNull();
    expect(classifyClass('opacity-50')).toBeNull();
    expect(classifyClass('font-mono')).toBeNull();
    expect(classifyClass('animate-spin')).toBeNull();
  });
});

describe('validateClassName', () => {
  it('keeps allowed classes and drops the rest', () => {
    const r = validateClassName('text-lg shadow-xl bg-blue-600 animate-pulse p-4');
    expect(r.className).toBe('text-lg bg-blue-600 p-4');
    expect(r.dropped).toEqual(['shadow-xl', 'animate-pulse']);
  });
});

describe('validateOverlay', () => {
  it('cleans each override, preserves hidden, and reports drops per dot', () => {
    const { overlay, dropped } = validateOverlay({
      a: { className: 'text-xl drop-shadow', hidden: true },
      b: { className: 'p-2' },
    });
    expect(overlay.a).toEqual({ className: 'text-xl', hidden: true });
    expect(overlay.b).toEqual({ className: 'p-2' });
    expect(dropped).toEqual({ a: ['drop-shadow'] });
  });
});
