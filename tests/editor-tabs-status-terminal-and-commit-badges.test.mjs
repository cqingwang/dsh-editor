import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

import { gitStatus, parseNumstat } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const workspaceSource = read('src/client/editor-workspace.tsx');
const terminalSource = read('src/client/components/terminal/TerminalPanel.tsx');
const commitSource = read('src/client/components/commit/CommitPanel.tsx');

/** One throwaway repository with a commit already in place. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r16-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'tracked.txt'), 'one\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('numstat keeps ordinary, binary and rename records apart', () => {
  const ordinary = parseNumstat('2\t0\ta.txt\u0000');
  assert.deepEqual(ordinary.get('a.txt'), { additions: 2, deletions: 0 });
  /* A binary change has no counts; inventing `+0 −0` would be a lie. */
  const binary = parseNumstat('-\t-\tlogo.png\u0000');
  assert.deepEqual(binary.get('logo.png'), { binary: true });
  /* `-z` framing puts the origin first and the new name second. */
  const renamed = parseNumstat('3\t1\t\u0000old.txt\u0000new.txt\u0000');
  assert.deepEqual(renamed.get('new.txt'), { additions: 3, deletions: 1 });
  assert.equal(renamed.has('old.txt'), false);
  assert.equal(parseNumstat('').size, 0);
});

test('status reports per-band line counts without touching the staged flag', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\nthree\n');
  await writeFile(join(dir, 'added.txt'), 'x\n');
  execFileSync('git', ['-C', dir, 'add', 'added.txt']);

  const status = await gitStatus(dir);
  const tracked = status.changes.find((change) => change.path === 'tracked.txt');
  const added = status.changes.find((change) => change.path === 'added.txt');

  /* The boolean `staged` flag and the counts answer different questions. */
  assert.equal(tracked.staged, false);
  assert.deepEqual(tracked.unstagedLines, { additions: 2, deletions: 0 });
  assert.equal(tracked.stagedLines, undefined);
  assert.equal(added.staged, true);
  assert.deepEqual(added.stagedLines, { additions: 1, deletions: 0 });
  assert.equal(added.unstagedLines, undefined);
});

test('both sides of an MM path keep their own reading', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\n');
  execFileSync('git', ['-C', dir, 'add', 'tracked.txt']);
  await writeFile(join(dir, 'tracked.txt'), 'one\ntwo\nthree\n');

  const status = await gitStatus(dir);
  const change = status.changes.find((entry) => entry.path === 'tracked.txt');
  assert.equal(change.status, 'MM');
  assert.deepEqual(change.stagedLines, { additions: 1, deletions: 0 });
  assert.deepEqual(change.unstagedLines, { additions: 1, deletions: 0 });
});

test('closing a dirty tab asks first and batch close asks once', () => {
  let confirmations = 0;
  let confirmResult = false;
  let openFiles = [
    { path: 'a.ts', content: '', dirty: true, mtime: null },
    { path: 'b.ts', content: '', dirty: true, mtime: null },
  ];
  const closeFile = loadTypeScriptCallback(workspaceSource, 'closeFile', {
    openFilesRef: { current: openFiles },
    window: { confirm: () => {
      confirmations += 1;
      return confirmResult;
    } },
    t: (key) => key,
    closeSplitTab: () => {},
    modelsRef: { current: new Map() },
    previewPathRef: { current: null },
    setPreviewPath: () => {},
    setOpenFiles: (value) => {
      openFiles = value;
    },
    activePathRef: { current: 'a.ts' },
    setActivePath: () => {},
  });
  closeFile('a.ts');
  assert.equal(confirmations, 1);
  assert.equal(openFiles.length, 2);
  confirmResult = true;
  closeFile('a.ts');
  assert.equal(confirmations, 2);
  assert.deepEqual(openFiles.map((file) => file.path), ['b.ts']);
});

test('the editor exposes the file path in its status bar, go to line and live facts', () => {
  const statusBar = read('src/client/components/editor/EditorStatusBar.tsx');
  const statusFacts = read('src/client/components/editor/EditorStatusFacts.tsx');
  const tabStrip = read('src/client/components/editor/EditorTabStrip.tsx');
  const editorCore = read('src/client/editor-core.ts');
  const navigationModel = read('src/client/components/editor/editor-navigation-model.ts');
  assert.doesNotMatch(workspaceSource, /breadcrumbSegments/);
  assert.doesNotMatch(workspaceSource, /t\('editor\.breadcrumb'\)/);
  assert.match(statusBar, /data-dsh-editor-status-path=''/);
  assert.match(tabStrip, /<MarkdownModeSwitch/);
  assert.match(editorCore, /id: 'dsh-editor\.gotoLine'/);
  assert.match(workspaceSource, /const gotoLine = React\.useCallback\(/);
  /* `123` and `12:7` both parse; the column is optional. */
  assert.ok(navigationModel.includes('/^(\\d+)(?:\\s*[:,]\\s*(\\d+))?$/u'));
  assert.match(statusFacts, /t\('editor\.lineCount', \{ count: lineStats\.lines \}\)/);
  assert.match(statusBar, /t\('editor\.selectionInfo', \{ count: lineStats\.selected \}\)/);
});

test('the status bar reports editor mode without rewriting user indentation', () => {
  const client = workspaceSource;
  assert.match(client, /fileMode=\{fileMode\}/);
  assert.doesNotMatch(client, /model\.detectIndentation\(/);
  assert.doesNotMatch(client, /pushEOL\(next\)/);
});

test('the terminal split tracks its focused pane and remembers its ratio', () => {
  const client = terminalSource;
  assert.match(client, /const \[focusedPane, setFocusedPane\] = React\.useState<'left' \| 'right'>\('left'\);/);
  assert.match(client, /data-dsh-terminal-pane-role='left'/);
  assert.match(client, /data-dsh-terminal-pane-role='right'/);
  assert.match(
    client,
    /const \[splitPercent, setSplitPercent\] = React\.useState\(\(\) =>\s+readStoredNumber\('dsh-editor\.terminal\.splitPercent', 50\),\s+\);/,
  );
  assert.match(client, /window\.localStorage\.setItem\('dsh-editor\.terminal\.splitPercent'/);
  /* Unsplit keeps the pane the user was typing in. */
  assert.match(client, /const keep = focusedPane === 'right' \? splitId : activeId;/);
});

test('commit rows render numstat badges instead of fabricating counts', () => {
  const client = commitSource;
  const lineCounts = read('src/client/components/ui/LineCounts.tsx');
  const commitModel = read('src/client/components/ui/commit-model.ts');
  assert.match(lineCounts, /function LineCounts\(\{ counts \}: LineCountsProps\)/);
  assert.match(lineCounts, /if \(counts\.binary === true\)/);
  assert.match(client, /<LineCounts counts=\{subtotalOf\(row\.changes, group\.id\)\} \/>/);
  /* Round 50 moved the summing into one shared helper the directory row reuses. */
  assert.match(commitModel, /export function subtotalOf\(/);
  assert.match(
    client,
    /const groupTotals = \(group(?::\s*[^)]+)?\)(?::\s*[^=]+)?\s*=>\s*subtotalOf\(group\.changes, group\.id\);/,
  );
});

test('the first shell auto-starts once the retained list settles', () => {
  const client = terminalSource;
  /* A ref here never re-runs the effect, so the dock stayed empty until a manual "+". */
  assert.match(client, /const \[loaded, setLoaded\] = React\.useState\(false\);/);
  assert.match(client, /setLoaded\(true\)/);
  assert.match(client, /if \(!loaded \|\| !available \|\| busy \|\| terminals\.length > 0 \|\| error !== null\) return;/);
  /* Round 150: `createTerminal`/`restoreTerminals` left the dependency list.
     Their identity changes on practically every parent render, so an effect
     depending on them re-fired and spawned a shell per render — the dock froze
     when `+` was pressed. `openedRef` keeps the body idempotent instead. */
  assert.match(client, /\}, \[available, busy, loaded, terminals\.length, error, onRequestClose\]\);/);
  assert.match(client, /if \(openedRef\.current\) \{/);
  assert.doesNotMatch(client, /loadedRef/);
});

test('a single shell can still be split into a fresh right pane', () => {
  const client = terminalSource;
  assert.match(client, /disabled=\{available === false \|\| activeId === null\}/);
  assert.match(client, /const created = await createTerminal\(\);/);
  assert.match(client, /setSplitId\(created\.id\);/);
});
