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

test('the open diff revalidates both disappearance and reappearance', () => {
  const diff = diffPreview();
  assert.match(diff, /const delay = localPathAvailable === false \? 1500 : 3000;/);
  assert.match(diff, /window\.setInterval\(checkLocalPath, delay\)/);
  assert.match(diff, /setLocalPathAvailable\(entry\?\.exists === true\)/);
  assert.doesNotMatch(diff, /if \(localPathAvailable !== false \|\| typeof target\?\.path/);
});
