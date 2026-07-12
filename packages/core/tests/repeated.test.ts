import { describe, expect, it } from 'vitest';
import { dotNodeSchema, panelNodeSchema } from '../src/schema';

describe('repeated flag', () => {
  it('accepts repeated: true on dots and panels', () => {
    const dot = dotNodeSchema.safeParse({
      id: 'a/panel#0/text~0',
      kind: 'text',
      element: 'p',
      className: '',
      dynamicClassName: false,
      required: false,
      content: [],
      repeated: true,
    });
    expect(dot.success).toBe(true);

    const panel = panelNodeSchema.safeParse({
      id: 'a/panel~0',
      kind: 'panel',
      element: 'div',
      className: '',
      dynamicClassName: false,
      children: [],
      repeated: true,
    });
    expect(panel.success).toBe(true);
  });

  it('rejects repeated: false — the flag is presence-only', () => {
    const panel = panelNodeSchema.safeParse({
      id: 'a/panel~0',
      kind: 'panel',
      element: 'div',
      className: '',
      dynamicClassName: false,
      children: [],
      repeated: false,
    });
    expect(panel.success).toBe(false);
  });
});
