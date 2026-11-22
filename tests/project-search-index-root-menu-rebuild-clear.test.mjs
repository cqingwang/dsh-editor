import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction, transpileTypeScriptFunction } from './ts-source.mjs';

const component = await readFile(
  new URL('../src/client/components/project/project-search-index.ts', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('Project root menu owns rebuild and clear search-index actions', () => {
  const menuItems = loadTypeScriptFunction(
    component.slice(component.indexOf('export function projectSearchIndexMenuItems('), component.length),
    'projectSearchIndexMenuItems',
  );
  const advanceRequest = loadTypeScriptFunction(
    component.slice(component.indexOf('export function advanceSearchIndexRequest('), component.length),
    'advanceSearchIndexRequest',
  );
  const requestOwns = loadTypeScriptFunction(
    component.slice(component.indexOf('export function searchIndexRequestOwns('), component.length),
    'searchIndexRequestOwns',
  );
  const failureMessage = loadTypeScriptFunction(
    component.slice(component.indexOf('export function searchIndexActionFailureMessage('), component.length),
    'searchIndexActionFailureMessage',
  );
  const calls = [];
  const actions = {
    rebuilding: false,
    clearing: false,
    progress: { processedFiles: 0, totalFiles: 0, contentBytes: 0 },
    rebuild: () => calls.push('rebuild'),
    cancel: () => calls.push('cancel'),
    clear: () => calls.push('clear'),
  };
  const items = menuItems((key) => key, actions);

  assert.deepEqual(
    items.map((item) => item.id),
    ['rebuildSearchIndex', 'cancelSearchIndexRebuild', 'clearSearchIndex'],
  );
  assert.deepEqual(
    items.map((item) => item.label),
    ['editor.rebuildSearchIndex', 'editor.searchIndexCancelRebuild', 'editor.clearSearchIndex'],
  );
  for (const item of items) item.run();
  assert.deepEqual(calls, ['rebuild', 'cancel', 'clear']);
  const running = menuItems(
    (key, params) => (params === undefined ? key : `${key}:${params.processed}/${params.total}`),
    {
      ...actions,
      rebuilding: true,
      progress: { processedFiles: 120, totalFiles: 500, contentBytes: 1024 },
    },
  );
  assert.deepEqual(
    running.map((item) => item.disabled),
    [true, false, true],
  );
  assert.equal(running[0].label, 'editor.searchIndexRebuildingProgress:120/500');
  const clearing = menuItems((key) => key, { ...actions, clearing: true });
  assert.deepEqual(
    clearing.map((item) => item.disabled),
    [true, true, true],
  );
  assert.equal(clearing[2].label, 'editor.searchIndexClearing');
  assert.match(component, /new AbortController\(\)/u);
  assert.match(component, /signal: controller\.signal/u);
  assert.match(component, /abortRef\.current\?\.abort\(\)/u);
  assert.match(component, /op: 'searchIndexStatus'/u);
  assert.match(component, /setInterval\(pollProgress, 300\)/u);
  assert.match(component, /now - lastProgressUpdate >= 1000/u);
  let requestSequence = 0;
  const firstRequest = advanceRequest(requestSequence);
  requestSequence = firstRequest;
  assert.equal(requestOwns(requestSequence, firstRequest), true);
  requestSequence = advanceRequest(requestSequence);
  assert.equal(requestOwns(requestSequence, firstRequest), false);
  const secondRequest = requestSequence;
  assert.equal(requestOwns(requestSequence, secondRequest), true);
  const translateFailure = (key, params) => (params === undefined ? key : `${key}:${params.message}`);
  assert.equal(
    failureMessage(translateFailure, new Error('unknown operation "rebuildSearchIndex"')),
    'editor.searchIndexRestartRequired',
  );
  assert.equal(
    failureMessage(translateFailure, new Error('disk is read-only')),
    'editor.searchIndexActionFailed:disk is read-only',
  );
  assert.match(component, /if \(!searchIndexRequestOwns\(requestSequenceRef\.current, requestId\)\) return;/u);
  assert.match(component, /requestSequenceRef\.current = advanceSearchIndexRequest\(requestSequenceRef\.current\);/u);
  assert.match(component, /op: 'rebuildSearchIndex', searchDirectoryRules/u);
  assert.match(workspace, /useProjectSearchIndexActions\(flashStatus, t, searchDirectoryRules\)/u);
  assert.match(workspace, /\.\.\.\(isRoot \? projectSearchIndexMenuItems\(t, projectSearchIndexActions\) : \[\]\)/);
});

test('unmount aborts an in-flight index clear before it can notify the stale workspace', async () => {
  const hookCode = transpileTypeScriptFunction(
    component.slice(component.indexOf('export function useProjectSearchIndexActions(')),
    'useProjectSearchIndexActions',
  );
  const advanceRequest = loadTypeScriptFunction(
    component.slice(component.indexOf('export function advanceSearchIndexRequest(')),
    'advanceSearchIndexRequest',
  );
  const requestOwns = loadTypeScriptFunction(
    component.slice(component.indexOf('export function searchIndexRequestOwns(')),
    'searchIndexRequestOwns',
  );
  const failureMessage = loadTypeScriptFunction(
    component.slice(component.indexOf('export function searchIndexActionFailureMessage(')),
    'searchIndexActionFailureMessage',
  );
  const hookStates = [];
  let hookCursor = 0;
  const fakeReact = {
    useRef(initialValue) {
      const index = hookCursor;
      hookCursor += 1;
      hookStates[index] ??= { kind: 'ref', value: { current: initialValue } };
      return hookStates[index].value;
    },
    useState(initialValue) {
      const index = hookCursor;
      hookCursor += 1;
      hookStates[index] ??= {
        kind: 'state',
        value: typeof initialValue === 'function' ? initialValue() : initialValue,
      };
      const record = hookStates[index];
      return [
        record.value,
        (next) => {
          record.value = typeof next === 'function' ? next(record.value) : next;
        },
      ];
    },
    useCallback(callback) {
      hookCursor += 1;
      return callback;
    },
    useMemo(compute) {
      hookCursor += 1;
      return compute();
    },
    useEffect(effect, dependencies) {
      const index = hookCursor;
      hookCursor += 1;
      const previous = hookStates[index];
      const changed =
        previous === undefined ||
        dependencies === undefined ||
        previous.dependencies === undefined ||
        dependencies.length !== previous.dependencies.length ||
        dependencies.some((value, dependencyIndex) => value !== previous.dependencies[dependencyIndex]);
      if (changed) {
        previous?.cleanup?.();
        hookStates[index] = {
          kind: 'effect',
          dependencies,
          cleanup: effect(),
        };
      }
    },
  };
  let resolveClear;
  let clearSignal = null;
  const notifications = [];
  const callFs = (payload, options) => {
    assert.equal(payload.op, 'clearSearchIndex');
    clearSignal = options.signal;
    return new Promise((resolve, reject) => {
      resolveClear = resolve;
      options.signal.addEventListener('abort', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };
  const hook = new Function(
    'React',
    'callFs',
    'advanceSearchIndexRequest',
    'searchIndexRequestOwns',
    'searchIndexActionFailureMessage',
    `${hookCode}\nreturn useProjectSearchIndexActions;`,
  )(fakeReact, callFs, advanceRequest, requestOwns, failureMessage);
  const render = () => {
    hookCursor = 0;
    return hook(
      (message) => notifications.push(message),
      (key) => key,
    );
  };

  const actions = render();
  actions.clear();
  assert.equal(clearSignal.aborted, false);
  const clearing = render();
  assert.equal(clearing.clearing, true);
  for (const effect of hookStates) {
    if (effect?.kind === 'effect') effect.cleanup?.();
  }
  assert.equal(clearSignal.aborted, true);
  resolveClear({ cleared: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(notifications, []);
});

test('an in-flight index clear is not exposed as cancellable after it may have committed', async () => {
  const hookCode = transpileTypeScriptFunction(
    component.slice(component.indexOf('export function useProjectSearchIndexActions(')),
    'useProjectSearchIndexActions',
  );
  const advanceRequest = loadTypeScriptFunction(
    component.slice(component.indexOf('export function advanceSearchIndexRequest(')),
    'advanceSearchIndexRequest',
  );
  const requestOwns = loadTypeScriptFunction(
    component.slice(component.indexOf('export function searchIndexRequestOwns(')),
    'searchIndexRequestOwns',
  );
  const failureMessage = loadTypeScriptFunction(
    component.slice(component.indexOf('export function searchIndexActionFailureMessage(')),
    'searchIndexActionFailureMessage',
  );
  const hookStates = [];
  let hookCursor = 0;
  const fakeReact = {
    useRef(initialValue) {
      const index = hookCursor;
      hookCursor += 1;
      hookStates[index] ??= { kind: 'ref', value: { current: initialValue } };
      return hookStates[index].value;
    },
    useState(initialValue) {
      const index = hookCursor;
      hookCursor += 1;
      hookStates[index] ??= {
        kind: 'state',
        value: typeof initialValue === 'function' ? initialValue() : initialValue,
      };
      const record = hookStates[index];
      return [
        record.value,
        (next) => {
          record.value = typeof next === 'function' ? next(record.value) : next;
        },
      ];
    },
    useCallback(callback) {
      hookCursor += 1;
      return callback;
    },
    useMemo(compute) {
      hookCursor += 1;
      return compute();
    },
    useEffect(effect, dependencies) {
      const index = hookCursor;
      hookCursor += 1;
      const previous = hookStates[index];
      const changed =
        previous === undefined ||
        dependencies === undefined ||
        previous.dependencies === undefined ||
        dependencies.length !== previous.dependencies.length ||
        dependencies.some((value, dependencyIndex) => value !== previous.dependencies[dependencyIndex]);
      if (changed) {
        previous?.cleanup?.();
        hookStates[index] = {
          kind: 'effect',
          dependencies,
          cleanup: effect(),
        };
      }
    },
  };
  let resolveClear;
  let clearSignal = null;
  const notifications = [];
  const callFs = (payload, options) => {
    assert.equal(payload.op, 'clearSearchIndex');
    clearSignal = options.signal;
    return new Promise((resolve, reject) => {
      resolveClear = resolve;
      options.signal.addEventListener('abort', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };
  const hook = new Function(
    'React',
    'callFs',
    'advanceSearchIndexRequest',
    'searchIndexRequestOwns',
    'searchIndexActionFailureMessage',
    `${hookCode}\nreturn useProjectSearchIndexActions;`,
  )(fakeReact, callFs, advanceRequest, requestOwns, failureMessage);
  const render = () => {
    hookCursor = 0;
    return hook(
      (message) => notifications.push(message),
      (key) => key,
    );
  };

  const actions = render();
  actions.clear();
  assert.equal(render().clearing, true);
  assert.equal(clearSignal.aborted, false);
  actions.cancel();
  assert.equal(clearSignal.aborted, false);
  assert.equal(render().clearing, true);
  assert.deepEqual(notifications, []);
  resolveClear({ cleared: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(render().clearing, false);
  assert.deepEqual(notifications, ['editor.searchIndexCleared']);
});

test('browser text search consumes the project index and Host exposes its maintenance operations', () => {
  assert.match(host, /case 'searchIndexStatus':\s+return ok\(await workspaceSearchIndexStatus\(root\)\);/);
  assert.match(
    host,
    /case 'rebuildSearchIndex':\s+return ok\(await rebuildWorkspaceSearchIndex\(root, \{\s+searchDirectoryRules: body\?\.searchDirectoryRules,\s+signal: request\.signal,\s+\}\)\);/,
  );
  assert.match(
    host,
    /case 'clearSearchIndex':\s+return ok\(await clearWorkspaceSearchIndex\(root, \{ signal: request\.signal \}\)\);/,
  );
  assert.match(host, /searchIndex: true,\s+signal: request\.signal/);
  assert.match(host, /filesOnly: body\?\.filesOnly === true/);
});

test('search-index actions and outcomes are localized in both dictionaries', () => {
  for (const key of [
    'rebuildSearchIndex',
    'searchIndexRebuilding',
    'searchIndexRebuildingProgress',
    'searchIndexCancelRebuild',
    'searchIndexRebuildCancelled',
    'searchIndexClearing',
    'clearSearchIndex',
    'searchIndexRebuildDone',
    'searchIndexRebuildTruncated',
    'searchIndexCleared',
    'searchIndexClearNone',
    'searchIndexActionFailed',
    'searchIndexRestartRequired',
  ]) {
    assert.equal((locales.match(new RegExp(`${key}:`, 'g')) ?? []).length, 2, `${key} must exist twice`);
  }
});
