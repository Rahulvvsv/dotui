import { dot } from '@dotui/elements';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Promptable } from '../src/promptable';
import { DotuiPromptProvider } from '../src/provider';
import type { PromptResult } from '../src/types';

const PANEL = 'demo/panel#0';

function renderOne(generate: (args: { prompt: string; panelId: string }) => Promise<PromptResult>) {
  return render(
    <DotuiPromptProvider generate={generate}>
      <Promptable panelId={PANEL}>
        <dot.panel __dotId={PANEL} className="p-2">
          content
        </dot.panel>
      </Promptable>
    </DotuiPromptProvider>,
  );
}

function promptGlobally(value: string) {
  fireEvent.click(screen.getByText('✨ Edit UI'));
  fireEvent.change(screen.getByPlaceholderText(/make everything/i), { target: { value } });
  fireEvent.click(screen.getByText('Apply'));
}

describe('failure and guardrail feedback', () => {
  it('shows an error toast when generation fails and clears busy', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('boom'));
    const { container } = renderOne(generate);
    promptGlobally('redden');
    await waitFor(() => expect(screen.getByText(/could not/i)).toBeTruthy());
    // busy cleared: the global input is enabled again and no overlay was applied
    expect(screen.getByPlaceholderText<HTMLInputElement>(/make everything/i).disabled).toBe(false);
    expect(container.querySelector('.bg-red-500')).toBeNull();
  });

  it('surfaces guardrail-dropped classes as an info toast', async () => {
    const generate = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
      Promise.resolve({
        overlay: { [panelId]: { className: 'text-lg' } },
        dropped: { [panelId]: ['shadow-2xl'] },
      });
    renderOne(generate);
    promptGlobally('shadows please');
    await waitFor(() => expect(screen.getByText(/shadow-2xl/)).toBeTruthy());
    expect(screen.getByText(/skipped disallowed styles/i)).toBeTruthy();
  });
});

describe('undo and reset', () => {
  const redden = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
    Promise.resolve({ overlay: { [panelId]: { className: 'bg-red-500' } } });

  it('undo restores the pre-prompt overlay', async () => {
    const onApplied = vi.fn();
    const { container } = render(
      <DotuiPromptProvider generate={redden} onApplied={onApplied}>
        <Promptable panelId={PANEL}>
          <dot.panel __dotId={PANEL} className="p-2">
            content
          </dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );

    fireEvent.click(screen.getByText('✨ Edit UI'));
    const undoButton = () => screen.getByRole<HTMLButtonElement>('button', { name: /undo/i });
    expect(undoButton().disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/make everything/i), {
      target: { value: 'redden' },
    });
    fireEvent.click(screen.getByText('Apply'));
    await waitFor(() => expect(container.querySelector('.bg-red-500')).toBeTruthy());
    expect(undoButton().textContent).toContain('(1)');

    fireEvent.click(undoButton());
    await waitFor(() => expect(container.querySelector('.bg-red-500')).toBeNull());
    expect(undoButton().disabled).toBe(true);

    const lastCall = onApplied.mock.calls.at(-1)?.[0];
    expect(JSON.stringify(lastCall)).not.toContain('bg-red-500');
  });

  it('reset panel restores initialOverlay for that panel only', async () => {
    const { container } = render(
      <DotuiPromptProvider generate={redden} initialOverlay={{ 'a/panel#0': { className: 'p-9' } }}>
        <Promptable panelId="a/panel#0">
          <dot.panel __dotId="a/panel#0">a</dot.panel>
        </Promptable>
        <Promptable panelId="b/panel#0">
          <dot.panel __dotId="b/panel#0">b</dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );
    promptGlobally('redden');
    await waitFor(() => expect(container.querySelectorAll('.bg-red-500')).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: 'Restyle a/panel#0 by prompt' }));
    fireEvent.click(screen.getByRole('button', { name: /reset a\/panel#0/i }));
    await waitFor(() => expect(container.querySelectorAll('.bg-red-500')).toHaveLength(1));
    expect(container.querySelector('.p-9')).toBeTruthy(); // a is back to its page-load look
  });
});

describe('global-run progress and cancel', () => {
  it('stop ends the run after the in-flight panel', async () => {
    const resolvers: Array<() => void> = [];
    const generate = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
      new Promise((resolve) => {
        resolvers.push(() => resolve({ overlay: { [panelId]: { className: 'bg-red-500' } } }));
      });

    const { container } = render(
      <DotuiPromptProvider generate={generate}>
        <Promptable panelId="a/panel#0">
          <dot.panel __dotId="a/panel#0">a</dot.panel>
        </Promptable>
        <Promptable panelId="b/panel#0">
          <dot.panel __dotId="b/panel#0">b</dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );
    promptGlobally('redden');

    const stop = await screen.findByRole('button', { name: /stop/i });
    fireEvent.click(stop); // cancel while panel 1 is in flight
    resolvers[0]?.(); // panel 1 finishes and applies; loop then sees the flag

    await waitFor(() => expect(screen.getByText(/stopped after 1 of 2/i)).toBeTruthy());
    expect(container.querySelectorAll('.bg-red-500')).toHaveLength(1);
    expect(resolvers).toHaveLength(1); // panel 2 was never requested
  });
});

describe('saved-visual delete', () => {
  it('arms then deletes, calling onDeleteVisual', async () => {
    const onDeleteVisual = vi.fn();
    const gen = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
      Promise.resolve({ overlay: { [panelId]: {} } });
    render(
      <DotuiPromptProvider
        generate={gen}
        savedVisuals={[{ id: 7, name: 'Calm', overlay: {} }]}
        onDeleteVisual={onDeleteVisual}
      >
        <Promptable panelId={PANEL}>
          <dot.panel __dotId={PANEL}>content</dot.panel>
        </Promptable>
      </DotuiPromptProvider>,
    );
    fireEvent.click(screen.getByText('✨ Edit UI'));
    const del = screen.getByRole('button', { name: 'Delete visual Calm' });
    fireEvent.click(del); // arm
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Calm' }));
    await waitFor(() => expect(onDeleteVisual).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Calm')).toBeNull();
  });
});

describe('keyboard access', () => {
  it('Escape closes the inline prompt popover', async () => {
    const gen = ({ panelId }: { prompt: string; panelId: string }): Promise<PromptResult> =>
      Promise.resolve({ overlay: { [panelId]: {} } });
    renderOne(gen);
    fireEvent.click(screen.getByText('✨ Edit UI'));
    fireEvent.click(screen.getByRole('button', { name: `Restyle ${PANEL} by prompt` }));
    const input = screen.getByPlaceholderText(/restyle this panel/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByPlaceholderText(/restyle this panel/i)).toBeNull());
  });
});
