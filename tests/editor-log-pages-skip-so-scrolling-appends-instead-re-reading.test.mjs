import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitLog } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const clientSource = () =>
  [
    read('src/client/editor-workspace.tsx'),
    read('src/client/components/project/ProjectPanel.tsx'),
    read('src/client/components/commit/CommitLog.tsx'),
    read('src/client/components/commit/CommitLogListState.tsx'),
    read('src/client/components/terminal/TerminalPanel.tsx'),
    read('src/client/terminal.ts'),
    read('src/client/find-tool.ts'),
    read('src/client/locales.ts'),
  ].join('\n');

/** A repository with five commits alternating between two authors. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r18-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  for (let index = 0; index < 5; index += 1) {
    await writeFile(join(dir, 'a.txt'), `line ${index}\n`);
    execFileSync('git', ['-C', dir, 'add', '.']);
    execFileSync('git', ['-C', dir, 'commit', '-qm', `commit ${index}`], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: index % 2 === 0 ? 'Alice' : 'Bob',
        GIT_AUTHOR_EMAIL: 'author@example.com',
        GIT_COMMITTER_NAME: 'Committer',
        GIT_COMMITTER_EMAIL: 'committer@example.com',
      },
    });
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('log pages with skip so scrolling appends instead of re-reading page one', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const first = await gitLog(dir, 2, 0);
  const second = await gitLog(dir, 2, 2);
  assert.deepEqual(
    first.map((commit) => commit.subject),
    ['commit 4', 'commit 3'],
  );
  assert.deepEqual(
    second.map((commit) => commit.subject),
    ['commit 2', 'commit 1'],
  );
  /* The two pages must not overlap, or a scroll would duplicate rows. */
  assert.equal(new Set([...first, ...second].map((commit) => commit.hash)).size, 4);
});

test('log filters by author as a literal substring', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const alice = await gitLog(dir, 20, 0, 'Alice');
  assert.deepEqual(
    alice.map((commit) => commit.subject),
    ['commit 4', 'commit 2', 'commit 0'],
  );
  assert.ok(alice.every((commit) => commit.author === 'Alice'));
  /* `A.*e` is a valid regex; as a literal author it must match nobody. */
  assert.deepEqual(await gitLog(dir, 20, 0, 'A.*e'), []);
  assert.equal((await gitLog(dir, 20, 0, '')).length, 5);
});

test('log clamps a bad skip to zero instead of failing', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const commits = await gitLog(dir, 2, -5);
  assert.deepEqual(
    commits.map((commit) => commit.subject),
    ['commit 4', 'commit 3'],
  );
});

test('commit asks before leaving unversioned files behind', () => {
  const client = clientSource();
  assert.match(
    client,
    /const untrackedLeft = \(\s*git\?\.changes \?\? \[\],?\s*\)\.filter\(\(change\) => change\.status === '\?\?' && !paths\.includes\(change\.path\)\);/,
  );
  assert.match(client, /!window\.confirm\(t\('editor\.commitUntracked', \{ count: untrackedLeft\.length \}\)\)/);
  /* The reminder must not block a commit that the user confirms. */
  assert.match(client, /\[amend, commitMessage, commitSelection, git, loadLog, root, t\]/);
});

test('the log pages in on scroll and shows its end', () => {
  const client = clientSource();
  assert.match(client, /const LOG_PAGE = 60;/);
  assert.match(client, /op: 'log',\s*limit: LOG_PAGE,\s*skip: commits\.length,\s*author: logAuthorRef\.current/);
  assert.match(client, /if \(page\.length < LOG_PAGE\) setLogExhausted\(true\);/);
  assert.match(client, /onScroll=\{\(event\) => \{/);
  assert.match(client, /t\('editor\.logEnd'\)/);
  /* The flag is declared before loadLog, which resets it (TDZ). */
  const stateAt = client.indexOf('const [\n    logExhausted,');
  const loadAt = client.indexOf('const loadLog = React.useCallback');
  assert.ok(stateAt > 0 && stateAt < loadAt);
});

test('project tree filters in place on ⌘F and keeps ancestors of a hit', () => {
  const client = read('src/client/components/project/ProjectPanel.tsx') + '\n' + read('src/client/terminal.ts');
  assert.match(client, /function filterTreeRows\(rows, query\) \{/);
  assert.match(client, /for \(const path of \[\.\.\.keep\]\) \{/);
  assert.match(client, /const localRows = React\.useMemo\(\(\) => filterTreeRows\(rows, search\), \[rows, search\]\);/);
  assert.match(client, /searchEntryRows\(searchEntries, projectName, compactDirectories, sortMode, manualOrder\)/);
  assert.match(client, /visibleRows\.map\(\(row, rowIndex\) => \{/);
  /* The editor keeps ⌘F while its textarea has focus. */
  assert.match(client, /if \(document\.activeElement\?\.closest\('\.monaco-editor'\) != null\) return;/);
});

test('a collapsed directory still shows the strongest descendant state', () => {
  const client = read('src/client/components/project/ProjectPanel.tsx') + '\n' + read('src/client/terminal.ts');
  /* Round 129 moved the precedence into `directoryTint` and dropped the letter: a
     changed folder is tinted on its name, never stamped with M/A/D. */
  assert.match(client, /const directoryStatus = \(path\) =>\s+directoryTint\(/);
  assert.match(client, /return \{ color: '#cf222e' \};/);
  assert.match(client, /return \{ color: '#8250df' \};/);
  /* The tint is computed from paths, so expansion state never gates it. */
  assert.match(client, /isDirectory && !selected && status === undefined && directoryStatus\(row\.path\) !== null/);
});

test('terminal clipboard shortcuts use the localized multi-line prompt', () => {
  const client = clientSource();
  assert.match(client, /t\('editor\.terminalPasteConfirm', \{ count: lines \}\)/);
  assert.match(client, /event\.key\.toLowerCase\(\) === 'c' \|\| event\.key\.toLowerCase\(\) === 'v'/);
  assert.match(client, /async function pasteIntoTerminal\([\s\S]{0,260}?onPasted\?:[\s\S]{0,80}?\): Promise<void>/u);
  /* A one-shot key handler reads the live translator through a ref. */
  assert.match(client, /const tRef = React\.useRef\(t\);/);
});

test('⌘F opens exactly one find surface, decided by focus', () => {
  const client = clientSource();
  /* The editor's own keybinding must not fire while another surface owns focus. */
  assert.match(client, /if \(document\.activeElement\?\.closest\('\.monaco-editor'\) == null\) return;/);
  /* The global find listener bows out for the terminal and for the Project tree. */
  assert.match(
    client,
    /if \(\s*event\.target instanceof Element &&\s*event\.target\.closest\('\[role="tree"\]'\) !== null\s*\)\s*return;/,
  );
  assert.match(client, /if \(document\.activeElement\?\.closest\('\[role="tree"\]'\) != null\) return;/);
});

test('a short first page already marks the history as ended', () => {
  const client = clientSource();
  /* Otherwise the "end of history" row never appears for small repositories. */
  assert.match(client, /setLogExhausted\(\s*firstPage\.length < LOG_PAGE,?\s*\);/);
});
