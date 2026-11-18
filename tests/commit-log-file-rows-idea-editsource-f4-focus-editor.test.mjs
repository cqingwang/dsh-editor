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

test('Commit Log file rows use IDEA EditSource F4 and focus the editor', () => {
  const log = source.slice(source.indexOf('function CommitLogDetailPane({'), source.indexOf('export { CommitLogDetailPane };'));
  assert.match(log, /onEditSource,/);
  assert.match(log, /event\.key === 'F4'[\s\S]*?if \(!localExists\) return;[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?onEditSource\?\.\(file\.path\);/);

  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /const editLocalVersion = React\.useCallback\(/);
  assert.match(workspace, /if \(opened\) focusEditorOnNextFrame\(editorRef\);/);
  assert.match(workspace, /onEditSource=\{editLocalVersion\}/);
});

test('Commit Log file menu advertises and reuses the same F4 path', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const menu = readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8');
  assert.match(menu, /id: 'openLocalVersion'[\s\S]*?shortcut: 'F4'[\s\S]*?if \(localExists !== false\) onEditLocalVersion\(path\)/);
  assert.match(workspace, /onEditLocalVersion: \(target\) => void editLocalVersion\(target\)/);
});
