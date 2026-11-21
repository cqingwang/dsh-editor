import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback, transpileTypeScriptFunction } from './ts-source.mjs';

const helperSource = await readFile(
  new URL('../src/client/components/search/search-scope.ts', import.meta.url),
  'utf8',
);
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const scopeEditorSource = await readFile(
  new URL('../src/client/components/search/FindScopeEditor.tsx', import.meta.url),
  'utf8',
);
const createSerializedScopeWriter = new Function(
  `${transpileTypeScriptFunction(helperSource, 'createSerializedFindScopeWriter')};
   return createSerializedFindScopeWriter;`,
)();
const serializedScopeWriter = createSerializedScopeWriter();
const writeScopeFile = new Function(
  'writeFindScopeFile',
  `${transpileTypeScriptFunction(helperSource, 'writeFindScopeFileWithGuard')};
   return writeFindScopeFileWithGuard;`,
)(serializedScopeWriter);

test('Find scope XML writes honor the repository update guard', async () => {
  let calls = 0;
  let releases = 0;
  assert.equal(
    await writeScopeFile({
      path: '.idea/scopes/dsh-editor.xml',
      content: '<scope/>',
      beginOperation: () => false,
      endOperation: () => {
        releases += 1;
      },
      callFs: async () => {
        calls += 1;
      },
    }),
    false,
  );
  assert.equal(calls, 0);
  assert.equal(releases, 0);

  assert.equal(
    await writeScopeFile({
      path: '.idea/scopes/dsh-editor.xml',
      content: '<scope/>',
      beginOperation: () => true,
      endOperation: () => {
        releases += 1;
      },
      callFs: async () => {
        calls += 1;
      },
    }),
    true,
  );
  assert.equal(calls, 1);
  assert.equal(releases, 1);
});

test('scope editors route file writes through the guarded callback', () => {
  assert.match(helperSource, /export function useFindScopeFileWrite\(/u);
  assert.match(helperSource, /writeFindScopeFileWithGuard\(\{/u);
  assert.match(editorSource, /useFindScopeFileWrite\(/u);
  assert.match(editorSource, /onWriteScopeXml=\{writeFindScopeXml\}/u);
  assert.match(scopeEditorSource, /onWriteScopeXml/u);
  assert.doesNotMatch(scopeEditorSource, /await callFs\(\{\s*op: 'write',\s*path,/u);
});

test('Scope XML writes serialize so the latest content is committed last', async () => {
  const requests = [];
  const writer = createSerializedScopeWriter();
  const settle = async () => {
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
  };
  const callFs = (payload) =>
    new Promise((resolve) => {
      requests.push({ content: payload.content, resolve });
    });

  const first = writer('.idea/scopes/dsh-editor.xml', 'first', callFs);
  const second = writer('.idea/scopes/dsh-editor.xml', 'second', callFs);
  await settle();
  assert.deepEqual(
    requests.map((request) => request.content),
    ['first'],
  );

  requests[0].resolve();
  await first;
  await settle();
  assert.deepEqual(
    requests.map((request) => request.content),
    ['first', 'second'],
  );
  requests[1].resolve();
  await second;
});

test('a blocked shared Scope save leaves local state unchanged', () => {
  const currentScopes = [{ id: 'existing', name: 'Existing', includePatterns: [], excludePatterns: [], shared: false }];
  const requestedScopes = [{ id: 'shared', name: 'Shared', includePatterns: [], excludePatterns: [], shared: true }];
  const errors = [];
  let stateUpdates = 0;
  const changeCustomFindScopes = loadTypeScriptCallback(editorSource, 'changeCustomFindScopes', {
    rootRef: { current: '/workspace' },
    writeCustomFindScopes: () => requestedScopes,
    normalizeCustomFindScopes: (scopes) => scopes,
    customFindScopes: currentScopes,
    sharedFindScopesRef: { current: [] },
    scopeWriteRevisionRef: { current: 0 },
    writeSharedFindScopes: () => false,
    serializeIdeaScopeXml: () => '<scopes/>',
    setEditorError: (message) => errors.push(message),
    setCustomFindScopes: () => {
      stateUpdates += 1;
    },
    setFindTool: () => {},
    t: (key) => key,
  });

  assert.deepEqual(changeCustomFindScopes(requestedScopes), currentScopes);
  assert.equal(stateUpdates, 0);
  assert.deepEqual(errors, ['editor.updateBusy']);
});

test('an async shared Scope write failure rolls local Scope state back', async () => {
  const currentScopes = [{ id: 'existing', name: 'Existing', includePatterns: [], excludePatterns: [], shared: false }];
  const requestedScopes = [{ id: 'shared', name: 'Shared', includePatterns: [], excludePatterns: [], shared: true }];
  const errors = [];
  const states = [];
  const stored = [];
  const changeCustomFindScopes = loadTypeScriptCallback(editorSource, 'changeCustomFindScopes', {
    rootRef: { current: '/workspace' },
    writeCustomFindScopes: (_root, scopes) => {
      stored.push(scopes);
      return scopes;
    },
    customFindScopes: currentScopes,
    sharedFindScopesRef: { current: [] },
    scopeWriteRevisionRef: { current: 0 },
    writeSharedFindScopes: (_content, onFailure) => {
      queueMicrotask(() => onFailure?.());
      return true;
    },
    serializeIdeaScopeXml: () => '<scopes/>',
    setEditorError: (message) => errors.push(message),
    setCustomFindScopes: (next) => states.push(next),
    setFindTool: () => {},
    t: (key) => key,
  });

  assert.deepEqual(changeCustomFindScopes(requestedScopes), requestedScopes);
  assert.deepEqual(states, [requestedScopes]);
  await Promise.resolve();
  assert.deepEqual(states.at(-1), currentScopes);
  assert.deepEqual(stored.at(-1), currentScopes);
});
