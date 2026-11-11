import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('project tool window exposes a context menu with create/rename/delete/copy', () => {
  const client = read('lib/client.js');
  assert.match(client, /function ContextMenu/);
  assert.match(client, /const buildTreeMenu = React\.useCallback/);
  assert.match(client, /id: 'rename'/);
  assert.match(client, /id: 'delete'/);
  assert.match(client, /id: 'copyPath'/);
  assert.match(client, /onContextMenu: \(payload\) => setMenu\(buildTreeMenu\(payload\)\)/);
});

test('tree supports inline rename and directory deletion on the host', () => {
  const host = read('lib/index.js');
  const client = read('lib/client.js');
  assert.match(host, /async function renameEntry/);
  assert.match(host, /async function deleteEntry/);
  assert.match(host, /refusing to delete the workspace root/);
  assert.match(host, /recursive: true/);
  assert.match(host, /workspaceFileOperations/);
  assert.match(client, /case 'rename'|op: 'rename'/);
  assert.match(client, /removeEntry/);
});

test('hidden files stay hidden until the toggle turns them on', () => {
  const host = read('lib/index.js');
  const client = read('lib/client.js');
  assert.match(host, /showHidden/);
  assert.match(host, /row\.name\.startsWith\('\.'\)/);
  assert.match(client, /const \[showHidden, setShowHidden\]/);
  assert.match(client, /editor\.showHidden/);
});

test('git decorations never collide with file-type badges', () => {
  const client = read('lib/client.js');
  const badge = client.slice(client.indexOf('function fileBadge'), client.indexOf('function Icon('));
  assert.doesNotMatch(badge, /label: 'M↓'/);
});

test('workspace manifest ships code, with the runtimes as dependencies', () => {
  const manifest = JSON.parse(read('package.json'));
  /* Round 151: monaco and xterm stopped being copies under `assets/`; they are
     ordinary `dependencies` now, so `files` only lists what this package owns. */
  assert.ok(manifest.files.includes('lib/terminal.js'));
  assert.ok(!manifest.files.includes('assets/xterm/*'));
  assert.match(manifest.scripts.test, /tests\/\*\.test\.mjs/);
  assert.ok(existsSync(join(root, 'lib/terminal.js')));
});

test('commit history and rollback stay available from the commit tool window', () => {
  const host = read('lib/index.js');
  const client = read('lib/client.js');
  assert.match(host, /async function gitRollback/);
  assert.match(host, /async function gitLog/);
  assert.match(host, /async function gitShowCommit/);
  assert.match(client, /function CommitLog/);
  /* Round 81 split this into the index-only and working-tree discards. */
  assert.match(client, /id: 'rollbackWorking'/);
  assert.match(client, /id: 'rollbackStaged'/);
  assert.match(client, /tabLog/);
});

test('inner tool-window tabs never close the editor split', () => {
  const client = read('lib/client.js');
  assert.match(client, /target\.closest\('\[data-dsh-editor-host\]'\) !== null\) return;/);
});

test('terminal dock supports shell choice, rename, clear and font size', () => {
  const host = read('lib/index.js');
  const hub = read('lib/terminal.js');
  const client = read('lib/client.js');
  assert.match(hub, /async shells\(\)/);
  assert.match(hub, /async profileFor\(/);
  assert.match(host, /case 'shells':/);
  assert.match(host, /shellPath/);
  assert.match(client, /openShellMenu/);
  assert.match(client, /commitRename/);
  assert.match(client, /storeFontSize/);
  assert.match(client, /terminalClear/);
});

test('external changes are detected by a cheap status signature poll', () => {
  const host = read('lib/index.js');
  const client = read('lib/client.js');
  assert.match(host, /async function gitSignature/);
  assert.match(host, /case 'signature':/);
  assert.match(client, /op: 'signature'/);
  assert.match(client, /visibilityState === 'hidden'/);
});

test('directories aggregate descendant git statuses as a tint, not a letter', () => {
  const client = read('lib/client.js');
  /* Round 129: a changed folder is tinted on its NAME; only files carry M/A/D. */
  assert.match(client, /const directoryStatus = \(path\) => directoryTint\(/);
  assert.match(client, /function directoryTint\(changes\)/);
  /* Round 131 tints the NAME for both files and folders; no letter is rendered. */
  assert.match(client, /isDirectory && !selected && status === undefined && directoryStatus\(row\.path\) !== null/);
});

test('tree drag-and-drop moves entries and refuses self-nesting', () => {
  const client = read('lib/client.js');
  assert.match(client, /const moveEntry = React\.useCallback/);
  assert.match(client, /onDragStart/);
  assert.match(client, /onDrop: \(source, target\) => void moveEntry/);
  assert.match(client, /moveIntoSelf/);
});

test('expanded directories persist per workspace and rehydrate children', () => {
  const client = read('lib/client.js');
  assert.match(client, /function readExpanded/);
  assert.match(client, /function writeExpanded/);
  assert.match(client, /dsh-editor\.expanded:/);
  assert.match(client, /hydrated\[path\]/);
});
