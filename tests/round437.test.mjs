import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  const end = source.indexOf('function NamePrompt(', start);
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
  assert.match(panel, /id: 'shelve',[\s\S]*?disabled: busy \|\| onShelve === undefined/);
});

test('Shelve toolbar action reuses the existing shelf menu and selection semantics', () => {
  const panel = commitPanel();

  assert.match(panel, /onShelve,/);
  assert.match(panel, /onShelve\?\.\(rect === undefined \? \{ x: 240, y: 120 \} : \{ x: rect\.left, y: rect\.bottom \+ 4 \}\)/);
  assert.match(source, /onShelve: \(position\) => void openShelveMenu\(position\)/);
});
