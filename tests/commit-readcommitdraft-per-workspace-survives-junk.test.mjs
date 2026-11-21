import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/terminal.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-core.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/find-tool.ts'), 'utf8'),
].join('\n');

/**
 * Evaluate one module-level helper from the client bundle with a stubbed window.
 *
 * The storage readers are pure apart from `localStorage`/`sessionId`, so this
 * runs the SHIPPING parser rather than matching its source text.
 * @param {string} name - helper to load.
 * @param {object} storage - `{getItem, setItem, removeItem}` stub.
 * @param {string} sessionId - value returned by `currentTerminalScope`.
 * @returns {Function} the helper.
 */
function loadWithStorage(name, storage, sessionId) {
  const body = transpileTypeScriptFunction(source, name);
  const palette = /const TERMINAL_COLORS = \[[^\]]+\];/u.exec(source)?.[0] ?? '';
  const factory = new Function(
    'window',
    'currentTerminalScope',
    `'use strict';\n${palette}\n${body}\nreturn ${name};`,
  );
  return factory({ localStorage: storage }, () => sessionId);
}

/** A localStorage stub backed by a Map, with the three methods the code uses. */
function storageOf(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    snapshot: () => Object.fromEntries(map),
  };
}

test('readCommitDraft is per workspace and survives junk', () => {
  const storage = storageOf({ 'dsh-editor.commitDraft:/w1': 'feat: half typed' });
  const read = loadWithStorage('readCommitDraft', storage, 's1');
  assert.equal(read('/w1'), 'feat: half typed');
  assert.equal(read('/w2'), '');
  assert.equal(read(''), '');
  assert.equal(read(undefined), '');
});

test('writeCommitDraft stores text and clears with an empty value', () => {
  const storage = storageOf();
  const write = loadWithStorage('writeCommitDraft', storage, 's1');
  write('/w1', 'feat: draft');
  assert.equal(storage.snapshot()['dsh-editor.commitDraft:/w1'], 'feat: draft');
  /* An empty draft must REMOVE the key, not leave a blank one behind. */
  write('/w1', '');
  assert.equal(storage.snapshot()['dsh-editor.commitDraft:/w1'], undefined);
  write('', 'ignored');
  assert.equal(Object.keys(storage.snapshot()).length, 0);
});

test('readTerminalColors keeps only known palette values', () => {
  const read = loadWithStorage(
    'readTerminalColors',
    storageOf({
      'dsh-editor.terminal.colors:s1': JSON.stringify({
        t1: '#cf222e',
        t2: '#8250df',
        t3: '#ff00ff',
        t4: 42,
      }),
    }),
    's1',
  );
  /* An arbitrary CSS colour would let stored data paint anything it likes. */
  assert.deepEqual(read(), { t1: '#cf222e', t2: '#8250df' });
});

test('readTerminalColors survives corrupt or foreign storage', () => {
  const corrupt = loadWithStorage('readTerminalColors', storageOf({ 'dsh-editor.terminal.colors:s1': '[1,2,3]' }), 's1');
  assert.deepEqual(corrupt(), {});
  const missing = loadWithStorage('readTerminalColors', storageOf(), 's1');
  assert.deepEqual(missing(), {});
  const foreign = loadWithStorage('readTerminalColors', storageOf({ 'dsh-editor.terminal.colors:s2': JSON.stringify({ t1: '#cf222e' }) }), 's1');
  assert.deepEqual(foreign(), {});
});

test('the tab menu offers colour cycling and closing forgets the colour', () => {
  assert.match(source, /const TERMINAL_COLORS = \['#cf222e', '#bf8700', '#1a7f37', '#2f65ca', '#8250df', '#1b7c83'\];/);
  assert.match(source, /const cycleTerminalColor = React\.useCallback\(\(id(?::\s*[^)]+)?\)(?::\s*[^{]+)?/);
  /* Cycling past the last colour returns to "no colour" rather than wrapping oddly. */
  assert.match(source, /if \(index === TERMINAL_COLORS\.length - 1\) delete next\[id\];/);
  assert.match(source, /id: 'color', label: t\('editor\.terminalColor'\)/);
  /* A closed tab's colour must not leak onto a later terminal with a reused id. */
  assert.match(source, /if \(current\[id\] === undefined\) return current;/);
});

test('the commit draft is debounced and cleared on commit', () => {
  assert.match(source, /const draft = readCommitDraft\(root\);/);
  assert.match(source, /draftTimer\.current = window\.setTimeout\(\(\) => \{/);
  assert.match(source, /writeCommitDraft\(root, commitMessage\);/);
  assert.match(source, /writeCommitDraft\(root, nextDraft\);/);
  /* An existing draft must never overwrite what the user already typed. */
  assert.match(source, /if \(draft !== ''\) setCommitMessage\(\(current\) => \(current === '' \? draft : current\)\);/);
});
