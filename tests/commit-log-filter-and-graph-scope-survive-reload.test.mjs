import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/commit/commit-log-view-preferences.ts', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

function compilePreferences() {
  const storage = new Map();
  const writes = [];
  const fakeWindow = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        writes.push([key, String(value)]);
        storage.set(key, String(value));
      },
      removeItem: (key) => storage.delete(key),
    },
  };
  const names = [
    'storedPreferenceKey',
    'readStoredCommitLogAuthor',
    'writeStoredCommitLogAuthor',
    'normalizeCommitGraphScope',
    'readStoredCommitGraphScope',
    'writeStoredCommitGraphScope',
  ];
  const functions = names.map((name) => transpileTypeScriptFunction(source, name)).join('\n');
  const compiled = new Function('window', `${functions}\nreturn { ${names.join(', ')} };`)(fakeWindow);
  return { storage, writes, ...compiled };
}

test('Commit Log author filter is workspace-scoped and avoids redundant writes', () => {
  const preferences = compilePreferences();
  preferences.writeStoredCommitLogAuthor('workspace-a', 'Ada Lovelace');
  preferences.writeStoredCommitLogAuthor('workspace-a', 'Ada Lovelace');
  preferences.writeStoredCommitLogAuthor('workspace-b', 'Grace Hopper');
  assert.equal(preferences.readStoredCommitLogAuthor('workspace-a'), 'Ada Lovelace');
  assert.equal(preferences.readStoredCommitLogAuthor('workspace-b'), 'Grace Hopper');
  assert.deepEqual(preferences.writes, [
    ['dsh-editor.commit.logAuthor:workspace-a', 'Ada Lovelace'],
    ['dsh-editor.commit.logAuthor:workspace-b', 'Grace Hopper'],
  ]);
  preferences.writeStoredCommitLogAuthor('workspace-a', '');
  assert.equal(preferences.readStoredCommitLogAuthor('workspace-a'), '');
  assert.equal(preferences.readStoredCommitLogAuthor('workspace-b'), 'Grace Hopper');
});

test('Commit Graph branch and commit scope round-trip', () => {
  const preferences = compilePreferences();
  assert.deepEqual(preferences.normalizeCommitGraphScope('', ''), null);
  assert.deepEqual(preferences.normalizeCommitGraphScope('main', ''), {
    branch: 'main',
    at: null,
  });
  preferences.writeStoredCommitGraphScope('workspace-a', 'main', '0123456789abcdef');
  assert.deepEqual(preferences.readStoredCommitGraphScope('workspace-a'), {
    branch: 'main',
    at: '0123456789abcdef',
  });
  preferences.writeStoredCommitGraphScope('workspace-a', '', '');
  assert.equal(preferences.readStoredCommitGraphScope('workspace-a'), null);
});

test('corrupt Commit Graph scope storage falls back to the unfiltered graph', () => {
  const preferences = compilePreferences();
  preferences.storage.set('dsh-editor.commit.graphScope:workspace-a', '{not-json');
  assert.equal(preferences.readStoredCommitGraphScope('workspace-a'), null);
});

test('the author hook hydrates only after root is known and persists subsequent edits', () => {
  const preferences = compilePreferences();
  preferences.storage.set('dsh-editor.commit.logAuthor:/workspace', 'Ada Lovelace');
  const hookCode = transpileTypeScriptFunction(source, 'useCommitLogAuthor');
  const states = [];
  let cursor = 0;
  const fakeReact = {
    useState(initialValue) {
      const index = cursor;
      cursor += 1;
      states[index] ??= initialValue;
      return [
        states[index],
        (next) => {
          states[index] = typeof next === 'function' ? next(states[index]) : next;
        },
      ];
    },
    useRef(initialValue) {
      const index = cursor;
      cursor += 1;
      states[index] ??= { current: initialValue };
      return states[index];
    },
    useEffect(effect) {
      cursor += 1;
      effect();
    },
    useCallback(callback) {
      cursor += 1;
      return callback;
    },
  };
  const hook = new Function(
    'React',
    'readStoredCommitLogAuthor',
    'writeStoredCommitLogAuthor',
    `${hookCode}\nreturn useCommitLogAuthor;`,
  )(fakeReact, preferences.readStoredCommitLogAuthor, preferences.writeStoredCommitLogAuthor);
  const render = (root) => {
    cursor = 0;
    return hook(root);
  };

  assert.equal(render('').ready, false);
  assert.equal(render('/workspace').ready, false);
  const restored = render('/workspace');
  assert.equal(restored.ready, true);
  assert.equal(restored.author, 'Ada Lovelace');
  assert.equal(restored.ref.current, 'Ada Lovelace');
  restored.setAuthor('Grace Hopper');
  assert.equal(render('/workspace').author, 'Grace Hopper');
  assert.equal(preferences.readStoredCommitLogAuthor('/workspace'), 'Grace Hopper');
});

test('EditorWorkspace wires author and graph scope persistence into Commit Log', () => {
  assert.match(workspace, /from '\.\/components\/commit\/commit-log-view-preferences';/u);
  assert.match(workspace, /useCommitLogInitialLoad/u);
  assert.match(workspace, /useCommitLogAuthor\(root\)/u);
  assert.match(workspace, /authorReady: commitLogAuthor\.ready/u);
  assert.match(workspace, /commitLogAuthor\.setAuthor\(value\)/u);
  assert.match(workspace, /commitLogStorage\.readGraphScope\(root\)/u);
  assert.match(workspace, /commitLogStorage\.writeGraphScope\(root, branchValue, atValue\)/u);
});
