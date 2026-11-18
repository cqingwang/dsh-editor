import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

test('selection restore is exposed only for a writable diff with real changed ranges', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /const actionableSelection =\s+selectionRange !== null &&\s+!diffReadOnly &&\s+!swapSides &&\s+!editLocked &&\s+!diffUnavailable &&\s+selectedCharChanges\(diffRef\.current\?\.getLineChanges\?\.\(\) \?\? \[\], selectionRange\)\.length > 0;/u,
  );
  assert.match(
    diff,
    /\.\.\.\(actionableSelection\s+\?\s+\[[\s\S]*?id: 'selection',[\s\S]*?label: t\('editor\.diffSelectionRestore'\),[\s\S]*?run: restoreSelection,[\s\S]*?\]\s+: \[\],?\)/u,
  );
});

test('restoreSelection refuses read-only diff sides even if called defensively', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const restoreSelection = React.useCallback');
  const end = diff.indexOf('const redoRestore = React.useCallback', start);
  const handler = diff.slice(start, end);
  assert.match(handler, /if \(diff === null \|\| diffLoadedRef\.current\?\.side === null\) return;/);
  assert.match(handler, /selectedCharChanges\(diff\.getLineChanges\(\), selectionRange\)/);
  assert.match(handler, /diff\.revertRangeMappings\(ranges\)/);
});

test('the same actionable flag gates toolbar and compact overflow entries', () => {
  const diff = diffPreview();
  assert.match(diff, /const diffToolbarActions = \[/);
  assert.match(diff, /actionableSelection/);
  assert.doesNotMatch(diff, /selectionRange === null\s+\?\s+\[\]\s+: \[\s*\{\s*id: 'selection'/u);
});
