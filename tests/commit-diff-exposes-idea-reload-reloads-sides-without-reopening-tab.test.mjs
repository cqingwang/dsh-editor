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

test('Diff exposes IDEA Reload and reloads both sides without reopening the tab', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[reloadGeneration, setReloadGeneration\] = React\.useState\(0\)/);
  assert.match(diff, /id: 'reloadDiff'[\s\S]*?icon: 'refresh'[\s\S]*?label: t\('editor\.diffReload'\)[\s\S]*?setReloadGeneration\(\(current\) => current \+ 1\)/);
  assert.match(
    diff,
    /\},\s+\[\s+captureDiffViewState,\s+clearCombinedColorDecorations,\s+clearConflictMarkerDecorations,\s+persistRestored,\s+reloadGeneration,\s+restoreDiffViewState,\s+target,\s+\]\);/u,
  );
  assert.ok(source.split('diffReload:').length - 1 >= 2);
});
