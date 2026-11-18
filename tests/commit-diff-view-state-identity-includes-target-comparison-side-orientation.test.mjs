import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const diffModelSource = readFileSync(join(root, 'src/client/components/ui/diff-model.ts'), 'utf8');
const diffViewStateKey = loadTypeScriptFunction(diffModelSource, 'diffViewStateKey');

test('diff view state identity includes target comparison and side orientation', () => {
  const working = diffViewStateKey({ path: 'a.txt', staged: false }, false);
  const index = diffViewStateKey({ path: 'a.txt', staged: true }, false);
  const swapped = diffViewStateKey({ path: 'a.txt', staged: false }, true);
  assert.notEqual(working, index);
  assert.notEqual(working, swapped);
  assert.equal(working, diffViewStateKey({ path: 'a.txt', staged: false }, false));
  assert.notEqual(
    diffViewStateKey({ path: 'a.txt', commit: 'aaaa1111' }, false),
    diffViewStateKey({ path: 'a.txt', commit: 'bbbb2222' }, false),
  );
});

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

test('the workspace owns diff view state across comparison tabs', () => {
  assert.match(source, /const diffViewStatesRef = React\.useRef\(new Map\(\)\)/);
  assert.match(source, /viewStatesRef: diffViewStatesRef/);
  assert.match(source, /function DiffPreview\(\{[^}]*viewStatesRef/u);
});

test('DiffPreview snapshots and restores both Monaco panes', () => {
  const diff = diffPreview();
  assert.match(diff, /const captureDiffViewState = React\.useCallback\(/);
  assert.match(diff, /originalEditor\?\.saveViewState\?\.\(\)/);
  assert.match(diff, /modifiedEditor\?\.saveViewState\?\.\(\)/);
  assert.match(diff, /originalPosition: originalEditor\?\.getPosition\?\.\(\) \?\? null/);
  assert.match(diff, /modifiedPosition: modifiedEditor\?\.getPosition\?\.\(\) \?\? null/);
  assert.match(diff, /const restoreDiffViewState = React\.useCallback\(/);
  assert.match(diff, /original\?\.restoreViewState\?\.\(state\.original\)/);
  assert.match(diff, /modified\?\.restoreViewState\?\.\(state\.modified\)/);
  assert.match(diff, /original\?\.setPosition\?\.\(originalPosition\)/);
  assert.match(diff, /modified\?\.setPosition\?\.\(modifiedPosition\)/);
});

test('target changes, Swap Sides and view mode changes preserve per-target state', () => {
  const diff = diffPreview();
  assert.match(diff, /const previousViewKey = diffViewKeyRef\.current/);
  assert.match(diff, /captureDiffViewState\(previousViewKey\)/);
  assert.match(diff, /diffViewKeyRef\.current = diffViewStateKey\(target, swapSidesRef\.current\)/);
  assert.match(diff, /const restoredView = restoreDiffViewState\(diffViewKeyRef\.current\)/);
  assert.match(diff, /if \(restoredView === false\) focusFirstHunkRef\.current\?\.\(\)/);

  const swap = diff.slice(
    diff.indexOf('React.useEffect(() => {\n    const previousState'),
    diff.indexOf('/* Track which hunk'),
  );
  assert.match(swap, /const previousState = captureDiffViewState\(diffViewKeyRef\.current\)/);
  assert.match(swap, /const nextKey = diffViewStateKey\(diffTargetRef\.current, swapSides\)/);
  assert.match(swap, /diffViewKeyRef\.current = nextKey/);
  assert.match(swap, /applyDiffSideOrder\(swapSides\)/);
  assert.match(swap, /restoreDiffViewState\(nextKey, previousState\)/);

  const mode = diff.slice(
    diff.indexOf('React.useEffect(() => {\n    const diff = diffRef.current;\n    if (diff === null) return;\n    const savedView'),
    diff.indexOf(
      'React.useEffect(() => {\n    const diff = diffRef.current;\n    if (diff === null) return;\n    diff.updateOptions({\n      hideUnchangedRegions',
    ),
  );
  assert.match(mode, /const savedView = captureDiffViewState\(diffViewKeyRef\.current\)/);
  assert.match(mode, /restoreDiffViewState\(diffViewKeyRef\.current, savedView\)/);
});

test('unmount stores the final diff view before disposing Monaco', () => {
  const diff = diffPreview();
  assert.match(diff, /captureDiffViewState\(diffViewKeyRef\.current\);[\s\S]*?diff\.setModel\(null\);/);
});
