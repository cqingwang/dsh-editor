import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Slice one callback/JSX block out of the client bundle.
 * @param {string} from - literal that starts the block.
 * @param {string} to - literal that ends it (first occurrence after `from`).
 * @returns {string} the slice.
 */
function slice(from, to) {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `${from} is missing from lib/client.js`);
  const end = source.indexOf(to, start);
  assert.notEqual(end, -1, `${to} is missing after ${from}`);
  return source.slice(start, end);
}

/* ── Project tree: only `.git` is filtered out ─────────────────────────── */

test('the tree lists every entry except .git, dot-files included', async (t) => {
  /* The filter used to drop `.env`, `.vscode`, `node_modules`, `dist`… before
     the "Show hidden files" toggle was even consulted, so the file a user came
     for was often unreachable from the tree. Only git's metadata stays hidden. */
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r148-tree-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, '.git'), { recursive: true });
  await mkdir(join(dir, '.vscode'), { recursive: true });
  await mkdir(join(dir, 'node_modules'), { recursive: true });
  await writeFile(join(dir, '.env'), 'A=1\n');
  await writeFile(join(dir, 'plain.txt'), 'x\n');

  /* `list` is the operation the tree calls; the API is the honest surface here. */
  const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
  assert.match(host, /const IGNORED_DIRECTORIES = new Set\(\['\.git'\]\);/);
  const listing = host.slice(host.indexOf('async function listDirectory('), host.indexOf('async function readTextFile('));
  assert.match(listing, /if \(IGNORED_DIRECTORIES\.has\(row\.name\)\) continue;/);
  /* No second per-name filter is allowed to sneak the old exclusions back in. */
  assert.doesNotMatch(listing, /node_modules|__pycache__|\.DS_Store/);
});

test('hidden entries are shown by default and the toggle is remembered', () => {
  /* A tree that hides `.env` behind a preference nobody finds is the same as a
     tree without it; the toggle now opts OUT of them instead. */
  assert.match(source, /const \[showHidden, setShowHidden\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.project\.showHidden', '1'\) !== '0'\);/);
  const toggle = slice('onToggleHidden: () =>', 'autoScroll,');
  assert.match(toggle, /window\.localStorage\.setItem\('dsh-editor\.project\.showHidden', next \? '1' : '0'\);/);
});

test('the workspace walks still skip heavy directories so scanning stays bounded', () => {
  /* Quick-open and the Move-to picker walk the whole tree; `node_modules`
     there would cost thousands of readdirs for files nobody picks. */
  const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
  assert.match(host, /const WALK_IGNORED = new Set\(\[/);
  assert.match(host, /'node_modules',/);
  const walk = host.slice(host.indexOf('async function listWorkspaceFiles('), host.indexOf('async function listWorkspaceDirectories('));
  assert.match(walk, /WALK_IGNORED\.has\(basename\(entry\.path\)\)/);
  assert.match(walk, /includeExcluded/);
  assert.match(walk, /VCS_METADATA_DIRECTORIES/);
  /* Dot-directories must survive that skip, or `.github/` is unreachable. */
  const dirs = host.slice(host.indexOf('async function listWorkspaceDirectories('), host.indexOf('async function describePaths('));
  assert.match(dirs, /listDirectory\(root, directory, \{ showHidden: true \}\)/);
  /* Round 152: the watcher no longer reuses that bound. The tree SHOWS and
     expands `node_modules`, so skipping it in the watcher meant its contents
     never followed the disk. It hides only what the tree hides, and caps the
     number of watchers a huge monorepo can create. */
  assert.match(host, /const WATCH_IGNORED = IGNORED_DIRECTORIES;/);
  assert.match(host, /const MAX_WATCHED_DIRECTORIES = 256;/);
  assert.match(host, /if \(this\.watchers\.size >= MAX_WATCHED_DIRECTORIES\) return;/);
});

/* ── Commit: one diff tab, replaced in place ───────────────────────────── */

test('a change opened from Commit gets ONE "Commit: <name>" tab', () => {
  /* IDEA keeps a single diff tab: previewing a second change swaps its content
     instead of piling up a tab per file. `diffTarget` is the content and
     `diffActive` says whether that tab currently owns the code area. */
  assert.match(source, /const \[diffActive, setDiffActive\] = React\.useState\(true\);/);
  assert.match(source, /const diffOpen = diffTarget !== null && diffActive;/);
  assert.match(source, /const diffTabName = diffTarget === null[\s\S]*?t\(diffIsCompare \? 'editor\.compareTab' : 'editor\.commitTab', \{ name: basename\(diffTarget\.path\) \}\);/);
  /* The tab is pinned first, so the one the user is reading never overflows. */
  assert.match(source, /const allTabs = diffTab === null \? openFiles : \[DIFF_TAB_KEY, \.\.\.openFiles\];/);
  assert.match(source, /const activeTabKey = diffActive \? DIFF_TAB_KEY : activePath;/);
  /* One key, not one per path: that is what makes it a replace. */
  assert.match(source, /const DIFF_TAB_KEY = '\\u0000dsh-editor-diff';/);
  assert.match(source, /key: 'dsh-editor-difftab',/);
});

test('selecting another change replaces the tab content instead of adding a tab', () => {
  const select = slice('onSelectDiff: (target) => {', 'onStage: (paths)');
  /* The same change toggles the preview off; a different one re-binds the tab. */
  assert.match(select, /setDiffTarget\(same \? null : target\);/);
  assert.match(select, /setDiffActive\(true\);/);
  assert.match(select, /const same = diffTarget !== null && diffActive && diffTarget\.path === target\.path && diffTarget\.staged === target\.staged;/);
});

test('the diff tab and the file tabs hand the code area back and forth', () => {
  /* Opening a file must not destroy the diff: the tab stays, ready to click. */
  const open = slice('const openFile = React.useCallback(async (path, options = {}) => {', 'openingRef.current.add(path);');
  assert.match(open, /setDiffActive\(false\);/);
  assert.doesNotMatch(open, /setDiffTarget\(null\);/);
  /* A file tab click does the same, and a tab click keeps the caret on the strip
     (a tree click already did) so the next arrow key still walks the rows. */
  assert.match(source, /onClick: \(\) => \{\n\s+setActivePath\(file\.path\);\n\s+setDiffActive\(false\);\n\s+\},/);
  assert.match(source, /const inTabs = activeNode\?\.closest\('\[data-dsh-editor-tabstrip\]'\) != null;/);
  assert.match(source, /'data-dsh-editor-tabstrip': '',/);
  /* The file surface owns either one or both editor groups, but never a diff,
     annotate view or editor terminal. */
  assert.match(source, /const fileSurfaceVisible = \(activeFile !== null \|\| splitFile !== null\)[\s\S]*?diffOpen === false[\s\S]*?annotateTarget === null[\s\S]*?editorTerminals\.length === 0/);
  assert.match(source, /display: fileSurfaceVisible \? 'flex' : 'none'/);
  assert.match(source, /diffOpen === false\n\s+\? null\n\s+: diffTarget\?\.repositoryVersion[\s\S]*?: React\.createElement\(DiffPreview/);
  assert.match(source, /const statusPath = statusFile === null/);
  assert.doesNotMatch(source, /breadcrumbSegments/);
});

test('closing the diff tab drops the preview and returns to the file', () => {
  const tab = slice("key: 'dsh-editor-difftab',", '/* One layout for this render');
  assert.match(tab, /onClick: \(\) => setDiffActive\(true\)/);
  assert.match(tab, /onAuxClick: \(event\) => \{/);
  assert.match(tab, /onClick: \(event\) => \{\n\s+event\.stopPropagation\(\);\n\s+closeDiff\(\);/);
  /* ⌘W closes the tab that is showing, which may be the diff. */
  assert.match(source, /if \(diffActiveRef\.current\) closeDiff\(\);/);
});

test('the diff tab is named Commit: for changes and Compare: for a revision', () => {
  /* Clipboard and revision comparisons are not commits; everything the Commit
     tool window opens is. */
  assert.match(source, /const diffIsCompare = diffTarget !== null && \(typeof diffTarget\.clipboardText === 'string' \|\| typeof diffTarget\.revision === 'string'\);/);
  assert.match(source, /commitTab: '提交: \{name\}',\n        compareTab: '比较: \{name\}',/);
  assert.match(source, /commitTab: 'Commit: \{name\}',\n        compareTab: 'Compare: \{name\}',/);
  /* The name in the tab is the file name; the full path stays in the tooltip. */
  assert.match(source, /title: diffTarget\.combined === true \|\| diffTarget\.repositoryVersion[\s\S]*?diffTabName\n\s+: `\$\{diffTabName\} — \$\{diffTarget\.path\}`,/);
  /* The overflow list carries the same entry, or the pinned tab could vanish. */
  assert.match(source, /entry === DIFF_TAB_KEY\n\s+\? \{ id: 'tab:diff', label: diffTabName, run: \(\) => setDiffActive\(true\) \}/);
});

test('the host still serves the workspace the tree reads', async () => {
  /* Sanity: the exported file operations the tests reach through are live, so a
     broken import in index.js cannot hide behind the source-text assertions. */
  assert.equal(typeof workspaceFileOperations.rename, 'function');
  assert.equal(typeof workspaceFileOperations.describe, 'function');
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r148-git-'));
  try {
    execFileSync('git', ['-C', dir, 'init', '-q']);
    assert.ok(readFileSync(join(dir, '.git', 'HEAD'), 'utf8').length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
