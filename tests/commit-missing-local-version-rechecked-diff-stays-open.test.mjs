import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'lib/client.js'), 'utf8');

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

test('a missing local version is rechecked while its diff stays open', () => {
  const diff = diffPreview();
  assert.match(diff, /callFs(?:<[^>]+>)?\(\{\s+op: 'exists',\s+paths: \[target\.path\],\s+\}\)/u);
  assert.match(diff, /startVisibilityGatedPoll\(checkLocalPath, delay\)/);
  assert.match(diff, /window\.addEventListener\('focus', checkLocalPath\)/);
  assert.match(diff, /stopPolling\(\)/);
});
