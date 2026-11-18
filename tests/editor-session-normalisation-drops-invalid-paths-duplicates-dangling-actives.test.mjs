import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const source = workspaceSource + '\n' + terminalSource;

function extractFunction(name) {
  return transpileTypeScriptFunction(terminalSource, name);
}

const normalizeEditorSession = new Function(
  `${extractFunction('normalizeEditorSession')}; return normalizeEditorSession;`,
)();

test('editor session normalisation drops invalid paths, duplicates and dangling actives', () => {
  const session = normalizeEditorSession({
    openPaths: ['README.md', 'README.md', '/abs.txt', '../escape.txt', 'docs/a.txt', '', 42],
    activePath: 'missing.txt',
    splitPaths: ['docs/a.txt', 'missing.txt', 'docs/a.txt'],
    splitPath: 'missing.txt',
    splitPercent: 91,
  });
  assert.deepEqual(session.openPaths, ['README.md', 'docs/a.txt']);
  assert.equal(session.activePath, 'README.md');
  assert.deepEqual(session.splitPaths, ['docs/a.txt']);
  assert.equal(session.splitPath, 'docs/a.txt');
  assert.equal(session.splitPercent, 80);
});

test('editor session persists only per workspace and restores after root is known', () => {
  assert.match(source, /dsh-editor\.editor\.session:\$\{root\}/);
  assert.match(source, /const sessionRestoredFor = React\.useRef\(''\)/);
  assert.match(source, /const sessionRestoringRef = React\.useRef\(false\)/);
  assert.match(source, /sessionRestoredFor\.current === root/);
  assert.match(source, /readEditorSession\(root(?::\s*[^)]+)?\)/);
  assert.match(source, /writeEditorSession\(root, \{/);
});

test('session restore opens only files that still read successfully', () => {
  const restore = source.slice(
    source.indexOf('const restoreEditorSession ='),
    source.indexOf('React.useEffect(() => {\n    void restoreEditorSession();'),
  );
  assert.match(restore, /const requested = \[\.\.\.new Set\(\[\.\.\.stored\.openPaths, \.\.\.stored\.splitPaths\]\)\]/);
  assert.match(restore, /if \(!\(await openFile\(path\)\)\) continue/);
  assert.match(restore, /const restoredOpenPaths = requested\.filter\(\(path\) => opened\.has\(path\)\)/);
  assert.match(restore, /setSplitTabs\(restoredSplitPaths\)/);
  assert.match(restore, /setEditorSplitPercent\(stored\.splitPercent\)/);
});

test('persistence excludes dirty tabs and never writes before restoration settles', () => {
  const persist = source.slice(
    source.indexOf('/* Persist clean editor tabs per workspace'),
    source.indexOf('/**\n       * Save one open model by path.'),
  );
  assert.match(persist, /sessionRestoredFor\.current !== root/);
  assert.match(persist, /sessionRestoringRef\.current/);
  assert.match(persist, /openFiles\.filter\(\(file\) => file\.dirty !== true\)/);
  assert.match(persist, /splitTabs\.filter\(\(path\) => cleanPaths\.has\(path\)\)/);
  assert.match(persist, /window\.setTimeout\(/);
});
