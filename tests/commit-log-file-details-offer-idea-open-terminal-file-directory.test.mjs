import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Commit Log file details offer IDEA Open in Terminal for the file directory', () => {
  const start = source.indexOf('const buildCommitFileMenu = React.useCallback');
  const end = source.indexOf('const buildLogMenu = React.useCallback', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const menu = source.slice(start, end);
  assert.match(menu, /id: 'openTerminal'[\s\S]*?label: t\('editor\.openInTerminal'\)[\s\S]*?disabled: localDirExists === false[\s\S]*?if \(localDirExists !== false\) openInTerminal\(dirname\(path\)\)/);

  const dependencies = menu.slice(menu.lastIndexOf('['));
  assert.match(dependencies, /\bopenInTerminal\b/);
});
