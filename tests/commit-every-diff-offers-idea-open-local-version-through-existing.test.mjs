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

test('every diff offers IDEA Open Local Version through existing openFile', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /function DiffPreview\(\{\s+t,\s+target,\s+monacoReady,\s+includedInCommit = false,\s+onClose,\s+onRestored,\s+onStatus,\s+onNotice,\s+onNavigate,\s+undoRef,\s+redoRef,\s+viewStatesRef,\s+searchInChangesRef = null,\s+filePosition = null,\s+onPreviousFile,\s+onNextFile,\s+onOpenLocal,\s+\}: DiffPreviewProps\)/u,
  );
  assert.match(diff, /\.\.\.\(typeof target\?\.path === 'string' && typeof onOpenLocal === 'function'/);
  assert.doesNotMatch(diff, /\.\.\.\(diffReadOnly && typeof target\?\.path === 'string' && typeof onOpenLocal === 'function'/);
  assert.match(diff, /id: 'openLocalVersion'/);
  assert.match(diff, /label: t\('editor\.openLocalVersion'\)/);
  assert.match(diff, /if \(localPathAvailable !== false\) onOpenLocal\(target\);/);

  assert.match(source, /onOpenLocal: \(localTarget\) => void openFile\(localTarget\.path\)/);
});

test('Open Local Version wording exists in both dictionaries', () => {
  assert.ok(source.split('openLocalVersion:').length - 1 >= 2, 'openLocalVersion must exist in both dictionaries');
});
