import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dot } from '../src/dot';

describe('dot.* behave like normal DOM elements', () => {
  it('forwards onClick', () => {
    const onClick = vi.fn();
    render(<dot.button onClick={onClick}>Save</dot.button>);
    fireEvent.click(screen.getByText('Save'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards hover/mouse handlers', () => {
    const onEnter = vi.fn();
    render(<dot.panel onMouseEnter={onEnter}>hoverable</dot.panel>);
    fireEvent.mouseEnter(screen.getByText('hoverable'));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('forwards onChange and value on an input', () => {
    const onChange = vi.fn();
    render(<dot.input aria-label="email" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('email'), { target: { value: 'a@b.c' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('forwards arbitrary DOM attributes (disabled, type, aria-, data-)', () => {
    render(
      <dot.button disabled type="submit" data-testid="btn" aria-label="save">
        S
      </dot.button>,
    );
    const button = screen.getByTestId('btn') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.type).toBe('submit');
    expect(button.getAttribute('aria-label')).toBe('save');
  });

  it('keeps the author hover/focus utility classes (merged, not dropped)', () => {
    render(
      <dot.button data-testid="h" className="hover:bg-blue-500 focus:ring">
        S
      </dot.button>,
    );
    const className = screen.getByTestId('h').className;
    expect(className).toContain('hover:bg-blue-500');
    expect(className).toContain('focus:ring');
  });

  it('forwards a ref to the underlying DOM node', () => {
    let node: HTMLButtonElement | null = null;
    render(
      <dot.button
        ref={(el) => {
          node = el;
        }}
        data-testid="r"
      >
        S
      </dot.button>,
    );
    expect(node).toBe(screen.getByTestId('r'));
  });
});
