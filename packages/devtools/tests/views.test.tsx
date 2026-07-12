import type { SchemaFile } from '@dotui/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverlaysView } from '../src/overlays-view';
import { SchemaView } from '../src/schema-view';
import type { OverlayRecordView } from '../src/types';

const schema: SchemaFile = {
  version: 1,
  panels: {
    'p/panel#0': {
      id: 'p/panel#0',
      kind: 'panel',
      element: 'div',
      className: 'flex gap-4',
      dynamicClassName: false,
      description: 'Root panel.',
      children: ['p/panel#0/text#0'],
    },
  },
  dots: {
    'p/panel#0/text#0': {
      id: 'p/panel#0/text#0',
      kind: 'text',
      element: 'h2',
      className: 'text-lg',
      dynamicClassName: false,
      required: true,
      description: 'The title.',
      content: [{ kind: 'dynamic', expr: 'name' }],
    },
  },
  palette: { seededFromAuthor: ['flex', 'text-lg'], families: ['text-size'] },
};

describe('SchemaView', () => {
  it('renders panels, dots, content slots, and palette from the schema prop', () => {
    render(<SchemaView schema={schema} />);
    expect(screen.getByText('p/panel#0')).toBeTruthy();
    expect(screen.getByText('p/panel#0/text#0')).toBeTruthy();
    expect(screen.getByText('text → <h2>')).toBeTruthy();
    expect(screen.getByText('required')).toBeTruthy();
    expect(screen.getByText('{name}')).toBeTruthy();
    expect(screen.getByText('flex')).toBeTruthy();
  });
});

const record: OverlayRecordView = {
  id: 7,
  panelId: 'p/panel#0',
  scope: 'default',
  appSchemaVersion: 1,
  prompt: 'make it pop',
  overlay: { 'p/panel#0/text#0': { className: 'text-red-500' } },
  version: 2,
  parentVersion: 1,
  isCurrent: true,
  createdAt: '2026-06-04T09:30:00.000Z',
};

describe('OverlaysView', () => {
  it('lists table rows grouped by panel with the live badge', () => {
    render(<OverlaysView records={[record]} />);
    expect(screen.getByText('overlays')).toBeTruthy();
    expect(screen.getByText('p/panel#0')).toBeTruthy();
    expect(screen.getByText('v2')).toBeTruthy();
    expect(screen.getByText('make it pop')).toBeTruthy();
    expect(screen.getByText('live')).toBeTruthy();
  });

  it('renders an empty state when there are no rows', () => {
    render(<OverlaysView records={[]} />);
    expect(screen.getByText(/No overlays saved yet/)).toBeTruthy();
  });
});
