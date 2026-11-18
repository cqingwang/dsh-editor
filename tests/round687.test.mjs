import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const names = [
  'normalizeNavigationLocation',
  'navigationHistoryRecord',
  'navigationHistoryStep',
];
const moduleStart = source.indexOf('/* ─────────────────────── code-navigation.ts');
const moduleEnd = source.indexOf('/* ─────────────────────── inline-styles.ts', moduleStart);
const navigation = new Function(
  `${source.slice(moduleStart, moduleEnd)}\nreturn { ${names.join(', ')} };`,
)();

test('Navigation history returns to the origin and then moves forward again', () => {
  const origin = { path: 'src/index.js', line: 4, column: 10 };
  const target = { path: 'src/terminal.js', line: 2, column: 14 };
  let history = navigation.navigationHistoryRecord({ back: [], forward: [] }, origin);
  const back = navigation.navigationHistoryStep(history, target, 'back');
  assert.deepEqual(back.target, origin);
  assert.deepEqual(back.history.forward, [target]);

  const forward = navigation.navigationHistoryStep(back.history, origin, 'forward');
  assert.deepEqual(forward.target, target);
  assert.deepEqual(forward.history.back, [origin]);
  assert.deepEqual(forward.history.forward, []);
});

test('A new navigation clears forward history and locations remain normalized', () => {
  const history = {
    back: [{ path: './src/index.js', line: 2, column: 3 }],
    forward: [{ path: 'src/terminal.js', line: 8, column: 4 }],
  };
  const next = navigation.navigationHistoryRecord(history, {
    path: '/src//with/../api.js',
    line: 0,
    column: -2,
  });
  assert.deepEqual(next.back, [
    { path: 'src/index.js', line: 2, column: 3 },
    { path: 'src/api.js', line: 1, column: 1 },
  ]);
  assert.deepEqual(next.forward, []);
});

test('Back and forward expose disabled boundaries instead of inventing a location', () => {
  const empty = { back: [], forward: [] };
  assert.equal(navigation.navigationHistoryStep(empty, null, 'back').target, null);
  assert.equal(navigation.navigationHistoryStep(empty, null, 'forward').target, null);
});

test('Both Monaco editors bind Cmd/Ctrl+[ and Cmd/Ctrl+] navigation history', () => {
  assert.match(source, /id: 'dsh-editor\.navigateBack'/u);
  assert.match(source, /id: 'dsh-editor\.navigateForward'/u);
  assert.match(source, /monaco\.KeyMod\.CtrlCmd \| monaco\.KeyCode\.BracketLeft/u);
  assert.match(source, /monaco\.KeyMod\.CtrlCmd \| monaco\.KeyCode\.BracketRight/u);
  assert.equal((source.match(/onNavigateBack: navigateBackHistory/g) ?? []).length, 2);
  assert.equal((source.match(/onNavigateForward: navigateForwardHistory/g) ?? []).length, 2);
  assert.match(source, /navigationBackAction: '后退'/u);
  assert.match(source, /navigationForwardAction: '前进'/u);
  assert.match(source, /navigationBackAction: 'Back'/u);
  assert.match(source, /navigationForwardAction: 'Forward'/u);
});

test('Location jumps record history while history traversal does not recurse', () => {
  const opener = source.slice(
    source.indexOf('const openFileAtLocation = React.useCallback'),
    source.indexOf('const flashStatus = React.useCallback'),
  );
  assert.match(opener, /navigationHistoryRecord\(\s*navigationHistoryRef\.current,/u);
  assert.match(opener, /recordHistory === false/u);
  assert.match(opener, /pendingReveal\.current = \{ path, line, column \}/u);
  assert.match(source, /navigationHistoryStep\(navigationHistoryRef\.current, current, direction\)/u);
  assert.match(source, /navigateHistory\('back'\)/u);
  assert.match(source, /navigateHistory\('forward'\)/u);
  assert.match(source, /openFileAtLocation\(step\.target\.path, step\.target\.line, step\.target\.column, \{ recordHistory: false \}\)/u);
});
