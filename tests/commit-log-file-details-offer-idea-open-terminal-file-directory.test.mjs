import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const menu = readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8');

test('Commit Log file details offer IDEA Open in Terminal for the file directory', () => {
  assert.match(menu, /id: 'openTerminal'[\s\S]*?label: t\('editor\.openInTerminal'\)[\s\S]*?disabled: localDirExists === false[\s\S]*?if \(localDirExists !== false\) onOpenTerminal\(path\)/);
  assert.match(source, /onOpenTerminal: \(target\) => openInTerminal\(dirname\(target\)\)/);
});
