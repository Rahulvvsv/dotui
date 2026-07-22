import { dot } from '@dotui/elements';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mergeOverlay } from '../src/merge';
import { Promptable } from '../src/promptable';
import { DotuiPromptProvider } from '../src/provider';
import type { PromptResult } from '../src/types';

const PANEL = 'demo/panel#0';

const gen = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
  Promise.resolve({ overlay: { [panelId]: { className: 'bg-red-500' } } });

function setup() {
  return render(
    <DotuiPromptProvider generate={gen}>
      <Promptable panelId={PANEL}>
        <dot.panel __dotId={PANEL} className="p-2">
          content
        </dot.panel>
      </Promptable>
    </DotuiPromptProvider>,
  );
}

describe('mergeOverlay', () => {
  it('accumulates className and applies hidden from the patch', () => {
    const merged = mergeOverlay(
      { a: { className: 'p-2' } },
      { a: { className: 'bg-red-500', hidden: true } },
    );
    expect(merged.a?.className).toBe('p-2 bg-red-500');
    expect(merged.a?.hidden).toBe(true);
  });
});

describe('DotuiPromptProvider', () => {
  it('applies a global prompt to every registered panel', async () => {
    const { container } = setup();
    fireEvent.click(screen.getByText(' Edit UI'));
    fireEvent.change(screen.getByPlaceholderText(/make everything/i), {
      target: { value: 'redden' },
    });
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => expect(container.querySelector('.bg-red-500')).toBeTruthy());
  });

  it('runs panels one at a time, threading each result into the next call’s current', async () => {
    const seen: Array<Record<string, unknown>> = [];
    const recordingGen = ({
      panelId,
      current,
    }: {
      prompt: string;
      panelId: string;
      current?: Record<string, unknown>;
    }): Promise<PromptResult> => {
      seen.push(current ?? {});
      return Promise.resolve({ overlay: { [panelId]: { className: 'bg-red-500' } } });
    };

    render(
      <DotuiPromptProvider generate={recordingGen}>
        <Promptable panelId="a/panel#0">
          <dot.panel __dotId="a/panel#0">a</dot.panel>
        </Promptable>
        <Promptable panelId="b/panel#0">
          <dot.panel __dotId="b/panel#0">b</dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );

    fireEvent.click(screen.getByText(' Edit UI'));
    fireEvent.change(screen.getByPlaceholderText(/make everything/i), {
      target: { value: 'redden' },
    });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => expect(seen).toHaveLength(2));
    // First panel starts from an empty overlay; the second sees the first panel's patch.
    expect(seen[0]).toEqual({});
    expect((seen[1] as Record<string, { className?: string }>)['a/panel#0']?.className).toBe(
      'bg-red-500',
    );
  });

  it('calls onApplied with the live overlay after a global run', async () => {
    const applied: Array<Record<string, unknown>> = [];
    render(
      <DotuiPromptProvider
        generate={gen}
        onApplied={(o) => {
          applied.push(o);
        }}
      >
        <Promptable panelId={PANEL}>
          <dot.panel __dotId={PANEL} className="p-2">
            content
          </dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );

    fireEvent.click(screen.getByText(' Edit UI'));
    fireEvent.change(screen.getByPlaceholderText(/make everything/i), {
      target: { value: 'redden' },
    });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => expect(applied).toHaveLength(1));
    expect((applied[0] as Record<string, { className?: string }>)[PANEL]?.className).toBe(
      'bg-red-500',
    );
  });

  it('applies a single-panel prompt from that panel’s ', async () => {
    const { container } = setup();
    fireEvent.click(screen.getByText(' Edit UI')); // enter edit mode
    fireEvent.click(screen.getByTitle('Prompt this panel'));
    fireEvent.change(screen.getByPlaceholderText(/restyle this panel/i), {
      target: { value: 'redden' },
    });
    fireEvent.click(screen.getByText('↵'));
    await waitFor(() => expect(container.querySelector('.bg-red-500')).toBeTruthy());
  });
});
