import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function commitPanel() {
  return source.slice(source.indexOf('function CommitPanel('), source.indexOf('function formatCommitDate('));
}

test('Commit Changes owns ⌘F when its pane has focus', () => {
  const panel = commitPanel();
  assert.match(panel, /const changeFilterRef = React\.useRef\(null\)/);
  assert.match(panel, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(panel, /event\.key\.toLowerCase\(\) !== 'f'/);
  assert.match(panel, /data-dsh-changes-panel/);
  assert.match(panel, /changeFilterRef\.current\?\.focus\(\)/);
  assert.match(panel, /changeFilterRef\.current\?\.select\(\)/);
  assert.match(panel, /event\.preventDefault\(\)/);
  assert.match(panel, /event\.stopPropagation\(\)/);
});

test('the filter input is the same node the shortcut focuses', () => {
  const panel = commitPanel();
  assert.match(panel, /ref: changeFilterRef,[\s\S]*?placeholder: t\('editor\.changeFilterPlaceholder'\)/);
  assert.match(panel, /'data-dsh-changes-panel': ''/);
});

test('editor find yields Changes panel shortcuts to the tool window', () => {
  const start = source.indexOf('const openEditorFind = React.useCallback');
  const end = source.indexOf('/* Recompute match count whenever the query or the active file changes. */', start);
  const handler = source.slice(start, end);
  assert.match(handler, /closest\('\[data-dsh-changes-panel\]'\)/);
});

test('filter shortcut wording exists in both dictionaries', () => {
  assert.ok(source.includes("changeFilterHint: '按路径过滤更改（⌘F）'"));
  assert.ok(source.includes("changeFilterHint: 'Filter changes by path (⌘F)'"));
});
