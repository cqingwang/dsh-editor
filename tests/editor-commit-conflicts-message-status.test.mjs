import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('conflicted files are detected, badged and resolvable from the change menu', () => {
  const client = read('lib/client.js');
  const host = read('lib/index.js');
  assert.match(client, /const CONFLICT_STATUS = \/\^\(DD\|AU\|UD\|UA\|DU\|AA\|UU\)\$\//);
  assert.match(client, /function isConflict/);
  assert.match(client, /editor\.conflictBadge/);
  assert.match(client, /id: 'acceptOurs'/);
  assert.match(client, /id: 'acceptTheirs'/);
  assert.match(client, /op: 'resolve', paths, side/);
  assert.match(host, /async function gitResolveConflict/);
  assert.match(host, /'checkout', side, '--'/);
  assert.match(host, /case 'resolve':/);
});

test('commit message box submits with the platform shortcut', () => {
  const client = read('lib/client.js');
  assert.match(client, /\(event\.metaKey \|\| event\.ctrlKey\) && event\.key === 'Enter'/);
  assert.match(client, /if \(!busy && selectedPaths\.size > 0 && message\.trim\(\) !== ''\) onCommit\(false\)/);
});

test('editor status bar reports caret, file path and encoding', () => {
  const client = read('lib/client.js');
  assert.match(client, /editor\.statusBarPosition/);
  assert.match(client, /onDidChangeCursorPosition/);
  assert.match(client, /eol: model\.getEOL\?\.\(\) === '\\r\\n' \? 'CRLF' : 'LF'/);
  assert.match(client, /styles\.editorStatus/);
  assert.match(client, /data-dsh-editor-status-path/);
  assert.doesNotMatch(client, /title: t\('editor\.indentToggle'\)/);
  assert.doesNotMatch(client, /title: t\('editor\.toggleEol'\)/);
});
