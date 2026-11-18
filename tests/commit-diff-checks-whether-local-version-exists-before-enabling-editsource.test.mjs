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

test('Diff checks whether the local version exists before enabling EditSource', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[localPathAvailable, setLocalPathAvailable\] = React\.useState\(null\)/);
  assert.match(diff, /callFs\(\{ op: 'exists', paths: \[target\.path\] \}\)/);
  assert.match(diff, /setLocalPathAvailable\(entry\?\.exists === true\)/);
});

test('Open Local Version is disabled and F4 is inert when the file is gone', () => {
  const diff = diffPreview();
  assert.match(diff, /id: 'openLocalVersion'[\s\S]*?disabled: localPathAvailable === false[\s\S]*?run: \(\) => \{[\s\S]*?if \(localPathAvailable !== false\) onOpenLocal\(target\);/);
  assert.match(diff, /typeof onOpenLocal === 'function'[\s\S]*?localPathAvailable !== false[\s\S]*?onOpenLocal\(target\);/);
  assert.match(diff, /items: hiddenDiffActionEntries\.map\(\(action\) => action === null \? null : \(\{[\s\S]*?disabled: action\.disabled === true/);
});
