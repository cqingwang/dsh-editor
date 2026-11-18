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

test('Monaco revert gutter buttons receive localised button semantics', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const localizeRevertButtons = React.useCallback');
  assert.notEqual(start, -1);
  const localizer = diff.slice(start, diff.indexOf('React.useEffect', start));
  assert.match(localizer, /querySelectorAll\('\.revertButton'\)/);
  assert.match(localizer, /t\('editor\.diffRestoreChange'\)/);
  assert.match(localizer, /t\('editor\.diffSelectionRestore'\)/);
  assert.match(localizer, /setAttribute\('role', 'button'\)/);
  assert.match(localizer, /setAttribute\('aria-label', label\)/);
  assert.match(localizer, /button\.tabIndex = 0/);
  assert.match(localizer, /button\.title = label/);
});

test('a scoped observer keeps revert buttons localised as Monaco rebuilds them', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const localizeRevertButtons = React.useCallback');
  const effect = diff.slice(diff.indexOf('React.useEffect', start), diff.indexOf('React.useEffect', diff.indexOf('React.useEffect', start) + 1));
  assert.match(effect, /new MutationObserver/);
  assert.match(effect, /childList: true/);
  assert.match(effect, /subtree: true/);
  assert.match(effect, /localizeRevertButtons\(\)/);
  assert.match(effect, /observer\.disconnect\(\)/);
});

test('Enter and Space on a revert gutter button dispatch its native click', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const onDiffHostKeyDown =');
  assert.notEqual(start, -1);
  const handler = diff.slice(start, diff.indexOf('const hidden =', start));
  assert.match(handler, /event\.key !== 'Enter' && event\.key !== ' '/);
  assert.match(handler, /closest\('\.revertButton'\)/);
  assert.match(handler, /event\.preventDefault\(\)/);
  assert.match(handler, /revertTarget\.click\(\)/);
  assert.match(diff, /onKeyDown: onDiffHostKeyDown/);
});

test('the narrow hunk capsule is focusable and keyboard-operable', () => {
  const diff = diffPreview();
  const start = diff.indexOf("className: 'dsh-editor-hunk-nav dsh-editor-hunk-capsule'");
  assert.notEqual(start, -1);
  const capsule = diff.slice(start, diff.indexOf('${hunks.index}/${hunks.total}', start));
  assert.match(capsule, /tabIndex: 0/);
  assert.match(capsule, /aria-label': t\('editor\.hunkCapsuleHint'/);
  assert.match(capsule, /onKeyDown:/);
  assert.match(capsule, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(capsule, /walkHunk\(/);
});
