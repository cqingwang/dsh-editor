import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback, loadTypeScriptFunction, transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source =
  readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/project/FileTreeView.tsx'), 'utf8') +
  '\n' +
  workspaceSource +
  '\n' +
  readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/commit/CommitLogFlatRow.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/injected-css.ts'), 'utf8') +
  '\n' +
  terminalSource +
  '\n' +
  readFileSync(join(root, 'src/client/editor-core.ts'), 'utf8');

/** `flattenRows` now calls `continuationFlags`; both must share one scope. */
function loadFlattenRows() {
  return new Function(
    [
      transpileTypeScriptFunction(terminalSource, 'continuationFlags'),
      transpileTypeScriptFunction(terminalSource, 'orderProjectEntriesByManual'),
      transpileTypeScriptFunction(terminalSource, 'compactDirectoryChain'),
      transpileTypeScriptFunction(terminalSource, 'flattenRows'),
      'return flattenRows;',
    ].join('\n'),
  )();
}

const flattenRows = loadFlattenRows();

test('an expanded empty directory shows a placeholder row', () => {
  const rows = flattenRows(
    [{ name: 'empty', path: 'empty', kind: 'directory' }],
    { empty: [] },
    new Set(['', 'empty']),
    'ws',
    '/root',
  );
  assert.deepEqual(
    rows.map((row) => row.kind),
    ['directory', 'placeholder'],
  );
  assert.equal(rows[1].depth, 1);
  assert.equal(rows[1].empty, true);
});

test('a still-loading directory shows nothing rather than an empty placeholder', () => {
  /* undefined means "children not fetched yet"; [] means "confirmed empty". */
  const rows = flattenRows(
    [{ name: 'slow', path: 'slow', kind: 'directory' }],
    {},
    new Set(['', 'slow']),
    'ws',
    '/root',
  );
  assert.deepEqual(
    rows.map((row) => row.name),
    ['slow'],
  );
});

test('a bare workspace shows the placeholder at the root', () => {
  const rows = flattenRows([], {}, new Set(['']), 'ws', '/root');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'placeholder');
  assert.equal(rows[0].depth, 0);
});

test('a collapsed directory never emits a placeholder', () => {
  const rows = flattenRows(
    [{ name: 'empty', path: 'empty', kind: 'directory' }],
    { empty: [] },
    new Set(['']),
    'ws',
    '/root',
  );
  assert.deepEqual(
    rows.map((row) => row.kind),
    ['directory'],
  );
});

test('the placeholder row is not selectable and cannot be dragged', () => {
  /* Keyboard navigation filters placeholders out; a selectable ghost row would break selection. */
  assert.match(workspaceSource, /const selectable = rows\.filter\(\s+\(row\) => row\.kind !== 'placeholder',\s+\);/);
  assert.match(source, /row\.kind === 'placeholder'/);
  assert.match(source, /t\('editor\.emptyDirectory'\)/);
});

test('dragging a row inside a multi-row selection moves the whole selection', () => {
  assert.match(source, /const payload =\s+selection\.has\(row\.path\) && selection\.size > 1/);
  assert.match(source, /const text = payload\.join\('\\n'\);/);
  assert.match(source, /event\.dataTransfer\?\.setData\(PROJECT_TREE_DRAG_MIME, text\);/);
  assert.match(source, /event\.dataTransfer\?\.setData\('text\/plain', text\);/);
  /* The drop side splits one-path-per-line and moves each entry. */
  assert.match(source, /const sources = readProjectTreeDragPaths\(event\.dataTransfer\);/);
  /* Round 51 replaced the inline filter/loop with one all-or-nothing plan. */
  assert.match(source, /const plan = planMoves\(sources, targetDirectory, existing\);/);
});

test('a multi-row move refuses to drop a directory into itself', () => {
  /* The refusal is decided by the planner, before any rename runs. */
  assert.match(source, /if \(plan\.intoSelf\.length > 0\) setTreeError\(t\('editor\.moveIntoSelf'\)\);/);
  assert.match(terminalSource, /target === source \|\| target\.startsWith\(`\$\{source\}\/`\)/);
});

test('open tabs follow a moved directory, not just a moved file', () => {
  const remapPathAfterMove = loadTypeScriptFunction(
    readFileSync(join(root, 'src/client/editor-core.ts'), 'utf8'),
    'remapPathAfterMove',
  );
  const nextOpenFiles = [];
  let previewPath = null;
  let activePath = null;
  const remapEditorPaths = loadTypeScriptCallback(workspaceSource, 'remapEditorPaths', {
    remapPathAfterMove,
    modelsRef: { current: new Map([['src/a.ts', { id: 'model' }]]) },
    previewPathRef: { current: 'src/preview.ts' },
    setPreviewPath: (value) => {
      previewPath = value;
    },
    setOpenFiles: (updater) => {
      nextOpenFiles.push(...updater([{ path: 'src/a.ts', content: '', dirty: false, mtime: null }]));
    },
    setActivePath: (updater) => {
      activePath = updater('src/a.ts');
    },
    setSplitTabs: (updater) => updater(['src/b.ts']),
    splitTabsRef: { current: ['src/b.ts'] },
    splitPathRef: { current: 'src/b.ts' },
    setSplitPath: () => {},
    setDiffTarget: (updater) => updater({ path: 'src/a.ts', staged: false }),
    setAnnotateTarget: (updater) => updater({ path: 'src/a.ts' }),
    setRecentFiles: (updater) => updater(['src/a.ts']),
    remapSearchDirectoryRulesAfterMove: (rules) => rules,
    setSearchDirectoryRules: (updater) => updater({ excludedDirectories: [], includedDirectories: [] }),
    writeSearchDirectoryRules: () => {},
    rootRef: { current: '/repo' },
    writeRecentFiles: () => {},
  });
  remapEditorPaths([['src', 'lib']]);
  assert.equal(nextOpenFiles[0].path, 'lib/a.ts');
  assert.equal(previewPath, 'lib/preview.ts');
  assert.equal(activePath, 'lib/a.ts');
});

test('a commit switches to the log and marks the new row', () => {
  assert.match(
    workspaceSource,
    /const \[\s*highlightedCommit,\s*setHighlightedCommit,\s*\] = React\.useState(?:<[^>]+>)?\(null\);/,
  );
  assert.match(source, /setHighlightedCommit\(head\);/);
  assert.match(source, /setCommitMode\('log'\);/);
  assert.match(source, /\.\.\.\(highlighted\s+\? \{\s+'data-dsh-log-new': '',\s+\}\s+: null\)/s);
  assert.match(source, /\[data-dsh-log-new\] \{ background:/);
});
