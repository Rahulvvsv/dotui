import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run } from '../src/cli';

const PANEL_SOURCE = `
export function Home() {
  return (
    <dot.panel className="flex flex-col">
      <dot.text>Hello</dot.text>
    </dot.panel>
  );
}
`;

describe('run', () => {
  let dir: string;
  let previousCwd: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dotui-cli-'));
    previousCwd = process.cwd();
    process.chdir(dir);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('builds a schema file from a panel source', () => {
    writeFileSync(join(dir, 'home.panel.tsx'), PANEL_SOURCE);
    const code = run(['build', '**/*.panel.tsx', '--out', 'out/schema.json']);
    expect(code).toBe(0);
    const schema = JSON.parse(readFileSync(join(dir, 'out', 'schema.json'), 'utf8'));
    expect(schema.panels['home/panel#0']).toBeDefined();
    expect(schema.dots['home/panel#0/text#0']).toBeDefined();
  });

  it('rejects a missing subcommand with exit code 1', () => {
    expect(run([])).toBe(1);
  });
});
