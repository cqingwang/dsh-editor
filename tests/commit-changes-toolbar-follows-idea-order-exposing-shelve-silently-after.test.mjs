import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source =
  (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const commitPanelSource = await readFile(
  new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url),
  'utf8',
);

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  const end = source.indexOf('export { CommitPanel };', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Changes toolbar follows IDEA order by exposing Shelve Silently after Show Diff', () => {
  const panel = commitPanel();
  const refresh = panel.indexOf("id: 'refresh'");
  const rollback = panel.indexOf("id: 'rollback'");
  const showDiff = panel.indexOf("id: 'showDiff'");
  const shelve = panel.indexOf("id: 'shelve'");
  const combinedDiff = panel.indexOf("id: 'combinedDiff'");

  assert.ok(refresh >= 0 && rollback > refresh && showDiff > rollback);
  assert.ok(shelve > showDiff && combinedDiff > shelve);
  assert.match(panel, /id: 'shelve',[\s\S]*?icon: 'stash',[\s\S]*?label: t\('editor\.shelve'\)/);
  assert.match(
    panel,
    /id: 'shelve',[\s\S]{0,500}?disabled:[\s\S]{0,160}?gitNotManaged[\s\S]{0,160}?commitShelveActionDisabled\(/u,
  );
});

test('Shelve toolbar action reuses the existing shelf menu and selection semantics', () => {
  const panel = commitPanel();

  assert.match(panel, /onShelve,/);
  assert.match(
    panel,
    /onShelve\?\.\(\s+rect === undefined\s+\? \{\s+x: 240,\s+y: 120,\s+\}\s+: \{\s+x: rect\.left,\s+y: rect\.bottom \+ 4,\s+\},?\s+\);/u,
  );
  assert.match(source, /onShelve: \(position\) => void openShelveMenu\(position\)/);
});

test('Shelve is disabled when no changes can be shelved or no handler exists', () => {
  const disabled = new Function(
    `${transpileTypeScriptFunction(commitPanelSource, 'commitShelveActionDisabled')}; return commitShelveActionDisabled;`,
  )();
  assert.equal(
    disabled(0, false, () => {}),
    true,
  );
  assert.equal(
    disabled(1, false, () => {}),
    false,
  );
  assert.equal(
    disabled(1, true, () => {}),
    true,
  );
  assert.equal(disabled(1, false, undefined), true);
});
