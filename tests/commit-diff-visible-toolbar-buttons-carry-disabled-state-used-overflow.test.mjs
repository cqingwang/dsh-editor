import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'));
const fileMenuSource = readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8');

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

function commitFileMenu() {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  return workspace.slice(
    workspace.indexOf('const buildCommitFileMenu = React.useCallback('),
    workspace.indexOf('const buildLogMenu = React.useCallback('),
  );
}

test('Diff visible toolbar buttons carry the disabled state used by the overflow menu', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /directDiffActionEntries\.map\(\(action, index\) =>[\s\S]*?<ToolbarButton\s+key=\{action\.id\}\s+icon=\{action\.icon\}\s+label=\{action\.label\}\s+active=\{toolbarActionActive\(action\)\}\s+disabled=\{action\.disabled === true\}\s+onClick=\{action\.run\}/u,
  );
});

test('Commit Log path copying does not require the working copy to exist', () => {
  const menu = fileMenuSource;
  const relative = menu.slice(menu.indexOf("id: 'copyRelative'"), menu.indexOf("id: 'copyAbsolute'"));
  const absolute = menu.slice(menu.indexOf("id: 'copyAbsolute'"), menu.indexOf('],', menu.indexOf("id: 'copyAbsolute'")));
  assert.match(relative, /onCopyText\(path\)/);
  assert.doesNotMatch(relative, /disabled/);
  assert.match(absolute, /onCopyText\(absoluteClipboardPath\)/);
  assert.doesNotMatch(absolute, /disabled/);
});

test('Diff local availability is cancelled and keyed by the current target path', () => {
  const diff = diffPreview();
  const start = diff.indexOf("if (typeof target?.path !== 'string' || target.path === '') {");
  const block = diff.slice(start, diff.indexOf('const diffToolbarRef', start));
  assert.match(block, /callFs(?:<[^>]+>)?\(\{\s+op: 'exists',\s+paths: \[target\.path\],\s+\}\)/u);
  assert.match(block, /if \(cancelled\) return;/);
  assert.match(block, /\}, \[target\?\.path\]\);/);
});
