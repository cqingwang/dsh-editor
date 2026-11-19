import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

test('Escape cancelling terminal tab rename returns focus to that tab', () => {
  const rename = panel.slice(
    panel.indexOf('renaming !== null && renaming.id === terminal.id'),
    panel.indexOf('</span>', panel.indexOf('renaming !== null && renaming.id === terminal.id')),
  );
  assert.match(rename, /event\.key === 'Escape'/u);
  assert.match(
    rename,
    /event\.key === 'Escape'[\s\S]*?setRenaming\(null\);[\s\S]*?window\.setTimeout\(\(\) => focusTerminalTab\(terminal\.id\), 0\);/u,
  );
});
