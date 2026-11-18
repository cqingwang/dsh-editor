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
    /directDiffActionEntries\.map\(\(action, index\) =>[\s\S]*?React\.createElement\(ToolbarButton, \{\n\s+key: action\.id,\n\s+icon: action\.icon,\n\s+label: action\.label,\n\s+active: toolbarActionActive\(action\),\n\s+disabled: action\.disabled === true,\n\s+onClick: action\.run,/,
  );
});

test('Commit Log path copying does not require the working copy to exist', () => {
  const menu = commitFileMenu();
  const relative = menu.slice(menu.indexOf("id: 'copyRelative'"), menu.indexOf("id: 'copyAbsolute'"));
  const absolute = menu.slice(menu.indexOf("id: 'copyAbsolute'"), menu.indexOf('],', menu.indexOf("id: 'copyAbsolute'")));
  assert.match(relative, /writeText\(path\)/);
  assert.doesNotMatch(relative, /disabled/);
  assert.match(absolute, /shellQuote\(root === '' \? path : `\$\{root\}\/\$\{path\}`\)/);
  assert.doesNotMatch(absolute, /disabled/);
});

test('Diff local availability is cancelled and keyed by the current target path', () => {
  const diff = diffPreview();
  const start = diff.indexOf("if (typeof target?.path !== 'string' || target.path === '') {");
  const block = diff.slice(start, diff.indexOf('const diffToolbarRef', start));
  assert.match(block, /callFs\(\{ op: 'exists', paths: \[target\.path\] \}\)/);
  assert.match(block, /if \(cancelled\) return;/);
  assert.match(block, /\}, \[localPathAvailable, target\?\.path\]\);/);
});
