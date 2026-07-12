import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dot } from '../src/dot';
import { DotOverlayProvider } from '../src/overlay';
import type { Overlay } from '../src/types';

function render(overlay: Overlay) {
  return renderToStaticMarkup(
    <DotOverlayProvider value={overlay}>
      <dot.panel __dotId="home/panel#0" className="flex p-4">
        <dot.text __dotId="home/panel#0/text#1" type="h1" className="bg-red-500 text-base">
          hi
        </dot.text>
      </dot.panel>
    </DotOverlayProvider>,
  );
}

describe('dot.* overlay merge', () => {
  it('renders the developer styling when there is no overlay', () => {
    const html = render({});
    expect(html).toContain('<div class="flex p-4">');
    expect(html).toContain('<h1 class="bg-red-500 text-base">hi</h1>');
  });

  it('merges the overlay, with the override winning on conflicting utilities', () => {
    const html = render({
      'home/panel#0': { className: 'gap-2' },
      'home/panel#0/text#1': { className: 'bg-blue-600 text-3xl' },
    });
    // panel: author classes kept, overlay added
    expect(html).toContain('flex');
    expect(html).toContain('gap-2');
    // text: bg-red-500 -> bg-blue-600 and text-base -> text-3xl (tailwind-merge resolves)
    expect(html).toContain('bg-blue-600');
    expect(html).not.toContain('bg-red-500');
    expect(html).toContain('text-3xl');
    expect(html).not.toContain('text-base');
  });

  it('never leaks the internal __dotId attribute to the DOM', () => {
    expect(render({})).not.toContain('__dotId');
  });

  it('strips dotUI metadata props (description, required) from the DOM', () => {
    const html = renderToStaticMarkup(
      <dot.button __dotId="b" description="primary action" required className="px-2">
        Save
      </dot.button>,
    );
    expect(html).toContain('<button class="px-2">Save</button>');
    expect(html).not.toContain('description');
    expect(html).not.toContain('required');
  });

  it('renders the tag chosen by the text type prop', () => {
    expect(render({})).toContain('<h1');
  });

  it('renders nothing when the overlay marks a dot hidden', () => {
    const html = render({ 'home/panel#0/text#1': { hidden: true } });
    expect(html).toContain('<div class="flex p-4">'); // panel still renders
    expect(html).not.toContain('<h1'); // the hidden text is gone
    expect(html).not.toContain('hi');
  });

  it('drops a hidden panel and its whole subtree', () => {
    const html = render({ 'home/panel#0': { hidden: true } });
    expect(html).toBe(''); // the root panel and everything under it is removed
  });
});
