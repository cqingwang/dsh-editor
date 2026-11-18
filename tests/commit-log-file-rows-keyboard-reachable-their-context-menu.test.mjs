import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/components/commit/CommitLogDetailPane.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8'),
].join('\n');

function commitLog() {
  return source.slice(source.indexOf('function CommitLogDetailPane({'), source.indexOf('export { CommitLogDetailPane };'));
}

test('Commit Log file rows are keyboard-reachable for their context menu', () => {
  const log = commitLog();
  assert.match(log, /tabIndex=\{0\}/);
  assert.match(log, /event\.key !== 'ContextMenu' && !\(event\.shiftKey && event\.key === 'F10'\)/);
  assert.match(log, /onFileMenu\?\.\(\{\s+path: file\.path,\s+hash: detail\.hash,\s+localExists,\s+localDirExists,\s+x: rect\.left \+ 12,\s+y: rect\.bottom,/s);
  assert.match(log, /event\.currentTarget\.focus\?\.\(\)/);
});

test('Commit Log file menu names the working copy action Open Local Version', () => {
  const menu = readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8');
  assert.match(menu, /id: 'openLocalVersion'/);
  assert.match(menu, /label: t\('editor\.openLocalVersion'\)/);
  assert.match(menu, /if \(localExists !== false\) onEditLocalVersion\(path\)/);
  assert.doesNotMatch(menu, /label: t\('editor\.openInEditor'\)/);
});
