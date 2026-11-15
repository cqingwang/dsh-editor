import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function commitLog() {
  return source.slice(source.indexOf('function CommitLog('), source.indexOf('function formatCommitDate('));
}

test('Commit Log owns ⌘F while its panel has focus', () => {
  const log = commitLog();
  assert.match(log, /const logFilterInputRef = React\.useRef\(null\)/);
  assert.match(log, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(log, /event\.key\.toLowerCase\(\) !== 'f'/);
  assert.match(log, /data-dsh-log-panel/);
  assert.match(log, /setShowFilter\(true\)/);
  assert.match(log, /logFilterInputRef\.current\?\.focus\(\)/);
  assert.match(log, /logFilterInputRef\.current\?\.select\(\)/);
  assert.match(log, /event\.preventDefault\(\)/);
  assert.match(log, /event\.stopPropagation\(\)/);
});

test('the hidden log filter input is the shortcut target', () => {
  const log = commitLog();
  assert.match(log, /ref: logFilterInputRef,[\s\S]*?placeholder: t\('editor\.logFilterPlaceholder'\)/);
  assert.match(log, /'data-dsh-log-panel': ''/);
});

test('editor find yields the Log panel shortcut to the tool window', () => {
  const start = source.indexOf('/* Cmd/Ctrl+F opens find; Cmd/Ctrl+Alt+F opens the same bar with replace. */');
  const end = source.indexOf('/* Recompute match count whenever the query or the active file changes. */', start);
  const handler = source.slice(start, end);
  assert.match(handler, /closest\('\[data-dsh-log-panel\]'\)/);
});

test('log filter shortcut wording exists in both dictionaries', () => {
  assert.ok(source.includes("logFilterHint: '过滤提交（⌘F）'"));
  assert.ok(source.includes("logFilterHint: 'Filter commits (⌘F)'"));
});
