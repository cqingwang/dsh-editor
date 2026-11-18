import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source = `${readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8')}\n${workspaceSource}`;

test('a directory row in the change tree has its own context menu', () => {
  const start = source.indexOf("if (row.kind === 'directory') {");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 3200);
  /* The directory row must open a menu that acts on the whole subtree. */
  assert.match(block, /onContextMenu=\{\(event\) => \{/);
  assert.match(
    block,
    /onContextMenu\?\.\(\{\s+directory: row\.path,\s+changes: row\.changes \?\? \[\],\s+group: group\.id,\s+x: event\.clientX,\s+y: event\.clientY,\s+\}\)/u,
  );
});

test('the directory menu stages, unstages and rolls back the subtree', () => {
  const calls = [];
  const buildChangeDirMenu = loadTypeScriptCallback(workspaceSource, 'buildChangeDirMenu', {
    t: (key) => key,
    basename: (path) => path.split('/').at(-1),
    restage: (paths, staged) => calls.push(['restage', paths, staged]),
    rollback: (paths) => calls.push(['rollback', paths]),
    revealPath: () => {},
    openInTerminal: () => {},
  });
  const menu = buildChangeDirMenu({
    directory: 'src',
    changes: [
      { path: 'src/a.ts', status: ' M' },
      { path: 'src/b.ts', status: ' M' },
    ],
    group: 'unstaged',
    x: 10,
    y: 20,
  });
  const findItem = (items, id) => {
    for (const item of items) {
      if (item?.id === id) return item;
      const nested = item?.items === undefined ? null : findItem(item.items, id);
      if (nested !== null) return nested;
    }
    return null;
  };
  findItem(menu.items, 'stageDirectory').run();
  findItem(menu.items, 'rollbackDirectory').run();
  assert.deepEqual(calls, [
    ['restage', ['src/a.ts', 'src/b.ts'], false],
    ['rollback', ['src/a.ts', 'src/b.ts']],
  ]);
});

test('the directory menu is wired into the panel', () => {
  assert.match(workspaceSource, /onContextMenu=\{\(payload\) => \{[\s\S]*?payload\.directory !== undefined[\s\S]*?buildChangeDirMenu\(/);
  assert.match(workspaceSource, /else if \(payload\.change !== undefined\)[\s\S]*?buildChangeMenu\(/);
  assert.match(workspaceSource, /const buildChangeDirMenu = React\.useCallback\(/);
});
