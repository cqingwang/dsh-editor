import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('reload restores only live editor terminals and persists the pruned placement', () => {
  const start = client.indexOf('React.useEffect(() => {\n        const remembered = readEditorTerminals();');
  const end = client.indexOf('      }, []);', start);
  assert.ok(start >= 0 && end > start, 'editor terminal restore effect is missing');
  const effect = client.slice(start, end);
  assert.match(effect, /const restored = listed\.filter\(\(terminal\) => remembered\.includes\(terminal\.id\)\);/u);
  assert.match(effect, /setEditorTerminals\(restored\);/u);
  assert.match(effect, /writeEditorTerminals\(restored\.map\(\(terminal\) => terminal\.id\)\);/u);
});
