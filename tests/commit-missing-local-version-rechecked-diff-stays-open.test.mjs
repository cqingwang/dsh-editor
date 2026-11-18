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

test('a missing local version is rechecked while its diff stays open', () => {
  const diff = diffPreview();
  assert.match(diff, /callFs\(\{ op: 'exists', paths: \[target\.path\] \}\)/);
  assert.match(diff, /window\.setInterval\(checkLocalPath, delay\)/);
  assert.match(diff, /window\.addEventListener\('focus', checkLocalPath\)/);
  assert.match(diff, /window\.clearInterval\(timer\)/);
});
