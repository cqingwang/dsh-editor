import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelSource = readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8');
const source =
  panelSource +
  '\n' +
  (readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') +
    '\n' +
    readFileSync(join(root, 'src/client/components/project/FileTreeView.tsx'), 'utf8')) +
  '\n' +
  readFileSync(join(root, 'lib/client.js'), 'utf8');

/* ── The reported bug: a blur commit renamed a folder into itself ───────── */

test('a double-click never starts a rename', () => {
  /* The report: clicking a few tree rows produced an unprompted rename, then
     `EINVAL: invalid argument, rename '…/assets' -> '…/assets/assets'`.
     Two causes stacked: a double-click opened the inline editor, and that editor
     commits on blur, so the next click committed a rename nobody asked for.
     Rename is now only reachable from the context menu (and F2/⇧F6). */
  const start = source.indexOf('onRowDoubleClick={(state, event) => {');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('onRowContextMenu=', start));
  assert.match(block, /const \{ row, isDirectory \} = state;/);
  assert.match(block, /event\.stopPropagation\(\);/);
  assert.doesNotMatch(block, /setRenameState|onStartRename|Rename/);
});

test('the rename destination comes from the original path, not a caller', () => {
  /* The TERMINAL tab has a `commitRename` too; this must anchor on the tree one,
     which is the version that calls the file API. */
  const projectClientSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
  const commit = projectClientSource.slice(
    projectClientSource.lastIndexOf('const commitRename = React.useCallback(async () => {'),
  );
  const head = commit.slice(0, commit.indexOf('const next ='));
  /* Derived here, so no `renameState.parent` can contradict it. */
  assert.match(head, /const parent = dirname\(renameState\.path\);/);
  assert.match(commit, /const next = parent === '' \? name : `\$\{parent\}\/\$\{name\}`;/);
  /* The identity case must exit without touching the disk. */
  assert.match(commit, /if \(next === renameState\.path\) \{/);
  const identity = commit.slice(commit.indexOf('if (next === renameState.path) {'));
  assert.ok(
    identity.indexOf('setRenameState(null);') < identity.indexOf('callFs('),
    'an unchanged name must not reach the host',
  );
  /* And nothing reads the removed field any more. */
  assert.doesNotMatch(source, /renameState\.parent/);
});

test('a directory renamed to its own name is a no-op upstream too', async (t) => {
  /* `renameEntry` creates the target's directory before renaming, so
     `assets -> assets/assets` built a directory INSIDE the source and then asked
     the OS to move a directory into its own child: EINVAL. */
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r153-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'assets', 'monaco'), { recursive: true });
  await writeFile(join(dir, 'assets', 'monaco', 'a.js'), 'x\n');

  /* Same path in and out is a no-op, and will not create `assets/assets`. */
  const same = await workspaceFileOperations.rename(dir, 'assets', 'assets');
  assert.equal(same.path, 'assets');
  assert.equal(same.from, 'assets');
  await assert.rejects(stat(join(dir, 'assets', 'assets')), { code: 'ENOENT' });

  /* A real rename still works. */
  const moved = await workspaceFileOperations.rename(dir, 'assets', 'static');
  assert.equal(moved.path, 'static');
  assert.match(await readFile(join(dir, 'static', 'monaco', 'a.js'), 'utf8'), /^x/);
});

test('the tree context menu keeps create and rename on separate targets', () => {
  /* Only RENAME changed semantics in round 153: it keeps the entry in its own
     parent. Create still lands in `createParent` — inside a clicked folder,
     beside a clicked file (round 154, where this was renamed from `parent`). */
  const menu = source.slice(source.indexOf('const buildTreeMenu = React.useCallback('));
  assert.match(menu, /const createParent = isDirectory \? row\.path : dirname\(row\.path\);/);
  const renameItem = menu.slice(menu.indexOf("id: 'rename'"), menu.indexOf("id: 'moveTo'"));
  assert.match(renameItem, /setRenameState\(\{ path: row\.path, value: basename\(row\.path\) \}\)/);
  const newFile = menu.slice(menu.indexOf("id: 'newFile'"), menu.indexOf("id: 'newFolder'"));
  assert.match(newFile, /startCreate\('file', createParent\)/);
});
