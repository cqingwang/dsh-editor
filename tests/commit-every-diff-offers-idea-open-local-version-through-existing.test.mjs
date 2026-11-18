import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
}

test('every diff offers IDEA Open Local Version through existing openFile', () => {
  const diff = diffPreview();
  assert.match(diff, /function DiffPreview\(\{ t, target, monacoReady, includedInCommit = false, onClose, onRestored, onStatus, onNotice, onNavigate, undoRef, redoRef, viewStatesRef, searchInChangesRef = null, filePosition = null, onPreviousFile, onNextFile, onOpenLocal \}\)/);
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
