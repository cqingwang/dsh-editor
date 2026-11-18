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

test('every diff with a local path offers IDEA EditSource, not only read-only diffs', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /\.\.\.\(typeof target\?\.path === 'string' && typeof onOpenLocal === 'function'/,
  );
  assert.doesNotMatch(
    diff,
    /\.\.\.\(diffReadOnly && typeof target\?\.path === 'string' && typeof onOpenLocal === 'function'/,
  );
  assert.match(diff, /shortcut: 'F4'/);
  assert.match(diff, /if \(localPathAvailable !== false\) onOpenLocal\(target\);/);
});

test('F4 opens the local source from the diff surface and keeps foreign editors out', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /event\.key === 'F4'[\s\S]*?insideDiffPane[\s\S]*?onOpenLocal\(target\)/,
  );
  assert.match(
    diff,
    /\[\s+actionableSelection,\s+applyLeftSide,\s+editLocked,\s+focusOppositeDiffPane,\s+localPathAvailable,\s+navigationPosition,\s+nextFileAction,\s+onClose,\s+onOpenLocal,\s+previousFileAction,\s+redoRestore,\s+restoreSelection,\s+searchInChanges,\s+target,\s+toggleCombinedFileCollapse,\s+undoRestore,\s+walkHunk,\s+\]/u,
  );
});
