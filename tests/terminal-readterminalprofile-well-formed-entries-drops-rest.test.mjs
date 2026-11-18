import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/terminal.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/find-tool.ts'), 'utf8'),
].join('\n');
const conflictBarsSource = readFileSync(join(root, 'src/client/components/editor/EditorConflictBars.tsx'), 'utf8');

/**
 * Evaluate one module-level helper from the client bundle against a fake `window`.
 *
 * These readers are pure except for `localStorage`, so supplying a stub makes the
 * SHIPPING code runnable in Node — a string assertion would not prove that a
 * malformed entry is actually dropped.
 * @param {string} name - helper to load.
 * @param {object} storage - `{getItem, setItem}` stub.
 * @param {string} sessionId - value returned by `currentTerminalScope`.
 * @returns {Function} the helper.
 */
function loadWithStorage(name, storage, sessionId) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
  let index = source.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  const body = source.slice(start, end);
  const factory = new Function(
    'window',
    'currentTerminalScope',
    `'use strict';\n${body}\nreturn ${name};`,
  );
  return factory({ localStorage: storage }, () => sessionId);
}

/** A localStorage stub backed by a Map. */
function storageOf(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  };
}

test('readTerminalProfile keeps well-formed entries and drops the rest', () => {
  const read = loadWithStorage(
    'readTerminalProfile',
    storageOf({
      'dsh-editor.terminal.profile:s1': JSON.stringify([
        { shell: '/bin/zsh', cwd: '/w', title: 'zsh' },
        { shell: '', cwd: '/w' },
        { cwd: '/w' },
        null,
        'nope',
        { shell: '/bin/bash' },
      ]),
    }),
    's1',
  );
  const entries = read();
  /* Only entries with a usable shell survive; a missing cwd becomes ''. */
  assert.deepEqual(entries, [
    { shell: '/bin/zsh', cwd: '/w', title: 'zsh' },
    { shell: '/bin/bash', cwd: '', title: '' },
  ]);
});

test('readTerminalProfile survives corrupt JSON and a missing key', () => {
  const corrupt = loadWithStorage('readTerminalProfile', storageOf({ 'dsh-editor.terminal.profile:s1': '{not json' }), 's1');
  assert.deepEqual(corrupt(), []);
  const empty = loadWithStorage('readTerminalProfile', storageOf(), 's1');
  assert.deepEqual(empty(), []);
  /* A different Session must not see another Session's tabs. */
  const other = loadWithStorage('readTerminalProfile', storageOf({ 'dsh-editor.terminal.profile:s2': JSON.stringify([{ shell: '/bin/sh' }]) }), 's1');
  assert.deepEqual(other(), []);
});

test('readTerminalProfile never restores more than four tabs', () => {
  const many = Array.from({ length: 9 }, (_, index) => ({ shell: `/bin/sh${index}` }));
  const read = loadWithStorage('readTerminalProfile', storageOf({ 'dsh-editor.terminal.profile:s1': JSON.stringify(many) }), 's1');
  assert.equal(read().length, 4);
});

test('readClosedTerminals honours the same trust rules and caps the history', () => {
  const many = Array.from({ length: 12 }, (_, index) => ({ shell: `/bin/sh${index}`, cwd: '/w' }));
  const read = loadWithStorage('readClosedTerminals', storageOf({ 'dsh-editor.terminal.closed:s1': JSON.stringify(many) }), 's1');
  assert.equal(read().length, 8);
  const bad = loadWithStorage('readClosedTerminals', storageOf({ 'dsh-editor.terminal.closed:s1': JSON.stringify([{ shell: 42 }, { shell: '/bin/zsh' }]) }), 's1');
  assert.deepEqual(bad().map((entry) => entry.shell), ['/bin/zsh']);
});

test('a deleted open file is announced as deleted and offers recreation', () => {
  assert.match(conflictBarsSource, /t\('editor\.externalDeleted'\)/);
  assert.match(conflictBarsSource, /t\('editor\.recreateFile'\)/);
  /* "Reload from disk" cannot work for a file that is gone; it must not be offered. */
  const missingBranch = conflictBarsSource.indexOf('externalChange.missing === true ? (');
  assert.ok(missingBranch > 0);
  assert.match(source, /const recreateActive = React\.useCallback\(async \(\) => \{/);
  assert.match(source, /op: 'write',\s+path,\s+content: model\.getValue\(\),\s+force: true,\s+create: true,/s);
});

test('a file that vanished is struck through in the project tree', () => {
  assert.match(
    source,
    /const \[\s+deletedPaths,\s+setDeletedPaths,\s+\] = React\.useState(?:<[^()]*>)?\(\(\) => new Set\(\)\);/s,
  );
  /* Applied through an updater now: an unchanged membership keeps the SAME Set,
     so React skips the re-render and a no-op refresh cannot flash the tree. */
  assert.match(source, /setDeletedPaths\(\(current\) => \{/);
  assert.match(source, /return vanished;/);
  assert.match(source, /deletedPaths\?\.has\?\.\(row\.path\)\s+\? \{\s+textDecoration: 'line-through',\s+opacity: 0\.6,\s+\}\s+: null/s);
});

test('closing a terminal records it for reopening', () => {
  assert.match(source, /const closing = terminalsRef\.current\.find\(\(terminal\) => terminal\.id === id\);/);
  assert.match(source, /if \(closing !== undefined\) rememberClosed\(closing\);/);
  assert.match(source, /const reopenClosed = React\.useCallback\(\s+async \(entry\) => \{/);
  assert.match(source, /reopen: closedHistory\.length === 0 \? null : \(\) => void reopenClosed\(closedHistory\[0\]\)/);
  assert.match(source, /t\('editor\.terminalReopen'\)/);
});
