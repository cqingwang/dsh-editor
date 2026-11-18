import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  const start = source.indexOf('function DiffPreview(');
  const end = source.indexOf('\n    function ', start + 10);
  assert.notEqual(start, -1, 'DiffPreview is missing');
  assert.notEqual(end, -1, 'DiffPreview end marker is missing');
  return source.slice(start, end);
}

test('Diff marks every model-dependent action unavailable without a loaded diff', () => {
  const diff = diffPreview();
  assert.match(diff, /const diffUnavailable = target === null \|\| state\.binary \|\| state\.missing \|\| diffLoadedRef\.current === null;/);
  assert.match(diff, /React\.createElement\(DiffViewModeControl, \{[\s\S]*?disabled: diffUnavailable,/);
  assert.match(diff, /id: 'swapSides',[\s\S]*?disabled: diffUnavailable,/);
  assert.match(diff, /id: 'disableEditing',[\s\S]*?disabled: swapSides \|\| diffUnavailable,/);
  assert.match(diff, /id: 'settings',[\s\S]*?disabled: diffUnavailable,/);
  assert.match(diff, /id: 'undo',[\s\S]*?disabled: editLocked \|\| diffUnavailable,/);
  assert.match(diff, /id: 'redo',[\s\S]*?disabled: editLocked \|\| diffUnavailable,/);
});

test('reload and local-source recovery remain available without a loaded diff', () => {
  const diff = diffPreview();
  assert.match(diff, /id: 'reloadDiff',[\s\S]*?label: t\('editor\.diffReload'\),\s+group: 'inspect',\s+run: \(\) => setReloadGeneration/);
  assert.match(diff, /id: 'openLocalVersion',[\s\S]*?disabled: localPathAvailable === false,/);
});
