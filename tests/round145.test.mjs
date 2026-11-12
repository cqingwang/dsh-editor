import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Evaluate one shipping helper by brace balance, so these tests exercise the
 * real function instead of a copy of its logic.
 * @param {string} name - function name at four-space indentation.
 * @returns {Function} the loaded function.
 */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const pushRecent = load('pushRecent');

/* ── Recent Files is an MRU, not a second Go-to-File ───────────────────── */

test('re-opening a file MOVES it to the head instead of duplicating', () => {
  /* A list that appends on every visit grows one entry per click and the newest
     position stops meaning "the file I was just in". */
  const start = ['c.ts', 'b.ts', 'a.ts'];
  assert.deepEqual(pushRecent(start, 'a.ts'), ['a.ts', 'c.ts', 'b.ts']);
  assert.equal(pushRecent(start, 'a.ts').length, 3, 'no duplicate row');
  /* Already at the head: return the SAME array, so React skips the re-render. */
  assert.equal(pushRecent(start, 'c.ts'), start);
});

test('the MRU list is bounded and ignores junk', () => {
  let list = [];
  for (let index = 0; index < 40; index += 1) list = pushRecent(list, `f${index}.ts`, 30);
  assert.equal(list.length, 30);
  assert.equal(list[0], 'f39.ts', 'newest first');
  assert.equal(pushRecent(list, ''), list, 'an empty path is not a visit');
  assert.equal(pushRecent(list, null), list);
  assert.deepEqual(pushRecent(undefined, 'a.ts'), ['a.ts'], 'a missing list starts empty');
});

test('the list is stored per workspace', () => {
  const read = source.slice(source.indexOf('function readRecentFiles('), source.indexOf('function writeRecentFiles('));
  const write = source.slice(source.indexOf('function writeRecentFiles('), source.indexOf('function pushRecent('));
  assert.match(read, /dsh-editor\.recent:\$\{root\}/);
  assert.match(write, /dsh-editor\.recent:\$\{root\}/);
  /* Two projects must not see each other's history. */
  assert.match(read, /if \(root === ''\) return \[\];/);
  assert.match(write, /if \(root === ''\) return;/);
});

/* ── ⌘E opens it, and it renders in MRU order ──────────────────────────── */

test('⌘E opens Recent Files without a filesystem walk', () => {
  const block = source.slice(source.indexOf('const openRecent = React.useCallback('), source.indexOf('React.useEffect(() => {\n        const onKeyDown = (event) => {\n          const meta = event.metaKey'));
  /* The list must be ready immediately; scanning the tree first defeats the
     point of a "where was I" popup. */
  assert.match(block, /const list = readRecentFiles\(rootRef\.current\);/);
  assert.doesNotMatch(block, /op: 'files'/);
  assert.match(block, /setPaletteMode\('recent'\)/);
  /* The keydown handler must actually CALL it, not just recognise the key. */
  const handler = source.slice(source.indexOf("if (event.key.toLowerCase() !== 'e') return;"), source.indexOf('}, [openRecent]);'));
  assert.match(handler, /\n\s+openRecent\(\);/);
});

test('Recent Files keeps its order; Go to File still ranks by score', () => {
  const palette = source.slice(source.indexOf('function QuickOpen('), source.indexOf('function fuzzyScore('));
  assert.match(palette, /const recent = mode === 'recent';/);
  /* The recent branch must NOT sort: "newest first" is the whole message. */
  const recentBranch = palette.slice(palette.indexOf('const matches = (recent'), palette.indexOf(': files\n'));
  assert.match(recentBranch, /files\.map\(\(path\) => \(\{ path, score:/);
  assert.doesNotMatch(recentBranch, /\.sort\(/);
  /* The Go-to-File branch keeps its ranking, or `⌘⇧O` stops being usable. */
  assert.match(palette, /\.sort\(\(left, right\) => right\.score - left\.score/);
});

test('an empty Recent Files list says so instead of "no matches"', () => {
  /* "No matches" implies a query failed; an empty workspace list is a different
     fact and sending the user hunting for a typo wastes their time. */
  assert.match(source, /recent && query === '' \? t\('editor\.recentEmpty'\) : t\('editor\.noMatches'\)/);
  assert.match(source, /title: recent \? t\('editor\.recentFiles'\) : t\('editor\.gotoFile'\)|'aria-label': recent \? t\('editor\.recentFiles'\) : t\('editor\.gotoFile'\)/);
});

/* ── discoverability: both popups sit in the Project toolbar ───────────── */

test('the Project Options menu exposes both navigation popups', () => {
  /* Without entries the only way to find ⌘E / ⌘⇧O is already knowing the key.
     Round 177 moved them under IDEA's Options disclosure so the visible toolbar
     keeps only the frequent actions. */
  const options = source.slice(source.indexOf('onOpenOptions: (event) => {'), source.indexOf('onCreateChange: (value) =>'));
  assert.match(options, /id: 'gotoFile', label: t\('editor\.gotoFileHint'\)/);
  assert.match(options, /id: 'recent', label: t\('editor\.recentFilesHint'\)/);
  /* They must be wired, not decorative. */
  assert.match(options, /void openQuickOpen\(\)/);
  assert.match(options, /openRecent\(\)/);
});

test('both popups carry their shortcut in the label', () => {
  /* IDEA prints the key in the tooltip; a bare "Recent Files" would still leave
     the keyboard path undiscoverable. */
  assert.match(source, /gotoFileHint: '转到文件（⌘⇧O）'/);
  assert.match(source, /recentFilesHint: '最近打开的文件（⌘E）'/);
  assert.match(source, /gotoFileHint: 'Go to File \(⌘⇧O\)'/);
  assert.match(source, /recentFilesHint: 'Recent Files \(⌘E\)'/);
});

/* ── terminal "Move to Editor" ────────────────────────────────────────── */

test('a moved terminal is a view onto the SAME PTY, not a new shell', () => {
  /* The host owns the process and its scrollback, so the move must only change
     which component renders the id. A second `create` here would kill the running
     command the user was watching. */
  const tab = source.slice(source.indexOf('function EditorTerminalTab('), source.indexOf('function TerminalPanel('));
  assert.match(tab, /terminalId: terminal\.id/);
  assert.doesNotMatch(tab, /op: 'create'/);
  /* Typing must reach the PTY the dock would have written to. */
  assert.match(tab, /onInput: \(data\) => onInput\(terminal\.id, data\)/);
});

test('the dock stops rendering a tab that moved, so one PTY has one view', () => {
  /* Two live xterm views on one id double every output write and fight over the
     grid. The tab stays in `terminals` (its ⌘1..9 slot still exists) but leaves
     the strip. */
  assert.match(source, /const dockTerminals = terminals\.filter\(\(terminal\) => !editorIds\.includes\(terminal\.id\)\);/);
  assert.match(source, /overflowTabs\(dockTerminals, visibleTabCount\(tabStripWidth, dockTerminals\.length\), activeId\)/);
  /* Moving into the editor releases a split bound to the same terminal. */
  const move = source.slice(source.indexOf('const moveTerminalToEditor'), source.indexOf('const returnTerminalToDock'));
  assert.match(move, /setSplitId\(\(current\) => \(current === terminal\.id \? null : current\)\)/);
});

test('the move survives a reload by id', () => {
  /* The PTY outlives the page; the placement does not, unless it is stored. */
  const read = source.slice(source.indexOf('function readEditorTerminals('), source.indexOf('function writeEditorTerminals('));
  const write = source.slice(source.indexOf('function writeEditorTerminals('), source.indexOf('function storeFontSize('));
  assert.match(read, /dsh-editor\.terminal\.editor:\$\{currentSessionId\(\)\}/);
  assert.match(write, /dsh-editor\.terminal\.editor:\$\{currentSessionId\(\)\}/);
});

test('"return to dock" reaches the panel that owns the placement', () => {
  /* The first cut dispatched at `[data-dsh-editor-host]` while listening on
     `[data-dsh-editor-workspace]` — different nodes, so the button did nothing.
     Measured: dockTabs stayed 0 and the editor kept the tab. */
  assert.match(source, /window\.addEventListener\('dsh-editor-return-terminal', onReturn\)/);
  assert.match(source, /window\.dispatchEvent\(new CustomEvent\('dsh-editor-return-terminal'/);
  assert.doesNotMatch(source, /querySelector\('\[data-dsh-editor-host\]'\)\?\.dispatchEvent/);
});

test('the editor area is one surface: a terminal hides the empty placeholder', () => {
  /* Both boxes in the same flex column split the height 50/50, so the shell sat
     under a "no file open" caption (measured pane 618px of 793px). */
  assert.match(source, /activeFile === null && diffOpen === false && annotateTarget === null && monacoError === null && editorTerminals\.length === 0/);
});

test('a reloaded page re-resolves its editor terminals from the host', () => {
  /* The dock reports what it moved, but after a reload the dock starts closed,
     so nothing reports and the stored id rendered nowhere (measured: stored list
     held the id, no tab appeared). The PTY is the HOST's, so asking it is enough. */
  const block = source.slice(source.indexOf('const remembered = readEditorTerminals();'), source.indexOf("}, []);\n\n      /* Restore the per-workspace MRU"));
  assert.match(block, /callTerminal\(\{ op: 'list' \}\)/);
  assert.match(block, /setEditorTerminals\(listed\.filter\(\(terminal\) => remembered\.includes\(terminal\.id\)\)\)/);
  /* A terminal closed while the page was away must not come back as a dead tab. */
  assert.match(block, /listed = Array\.isArray\(value\?\.terminals\) \? value\.terminals : \[\]/);
});
