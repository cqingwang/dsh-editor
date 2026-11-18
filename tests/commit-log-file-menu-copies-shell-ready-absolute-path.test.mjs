import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const fileMenuSource = readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8');

test('Commit Log file menu copies a shell-ready absolute path', () => {
  const workspace = source;
  const menu = fileMenuSource;
  assert.match(menu, /id: 'copyAbsolute'/);
  assert.match(menu, /label: t\('editor\.copyAbsolutePath'\)/);
  assert.match(workspace, /absoluteClipboardPath: shellQuote\(root === '' \? path : `\$\{root\}\/\$\{path\}`\)/);
  assert.match(workspace, /onCopyText: \(value\) => void copyText\(value\)/);
});
