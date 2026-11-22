import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction, transpileTypeScriptFunction } from './ts-source.mjs';

const component = await readFile(
  new URL('../src/client/components/project/project-search-index.ts', import.meta.url),
  'utf8',
);
const panel = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

function loadSearchIndexFunction(name) {
  return loadTypeScriptFunction(
    component.slice(component.indexOf(`export function ${name}(`), component.length),
    name,
  );
}

function createFakeReact() {
  const states = [];
  let cursor = 0;
  return {
    states,
    resetCursor() {
      cursor = 0;
    },
    React: {
      useRef(initialValue) {
        const index = cursor;
        cursor += 1;
        states[index] ??= { kind: 'ref', value: { current: initialValue } };
        return states[index].value;
      },
      useState(initialValue) {
        const index = cursor;
        cursor += 1;
        states[index] ??= {
          kind: 'state',
          value: typeof initialValue === 'function' ? initialValue() : initialValue,
        };
        const record = states[index];
        return [
          record.value,
          (next) => {
            record.value = typeof next === 'function' ? next(record.value) : next;
          },
        ];
      },
      useCallback(callback) {
        cursor += 1;
        return callback;
      },
      useMemo(compute) {
        cursor += 1;
        return compute();
      },
      useEffect(effect, dependencies) {
        const index = cursor;
        cursor += 1;
        const previous = states[index];
        const changed =
          previous === undefined ||
          dependencies === undefined ||
          previous.dependencies === undefined ||
          dependencies.length !== previous.dependencies.length ||
          dependencies.some((value, dependencyIndex) => value !== previous.dependencies[dependencyIndex]);
        if (!changed) return;
        previous?.cleanup?.();
        states[index] = {
          kind: 'effect',
          dependencies,
          cleanup: effect(),
        };
      },
    },
  };
}

function loadSearchIndexHook(fakeReact, callFs) {
  const hookCode = transpileTypeScriptFunction(
    component.slice(component.indexOf('export function useProjectSearchIndexActions(')),
    'useProjectSearchIndexActions',
  );
  const advanceRequest = loadSearchIndexFunction('advanceSearchIndexRequest');
  const requestOwns = loadSearchIndexFunction('searchIndexRequestOwns');
  const statusNeedsUpdate = loadSearchIndexFunction('searchIndexStatusNeedsUpdate');
  const failureMessage = loadSearchIndexFunction('searchIndexActionFailureMessage');
  return new Function(
    'React',
    'callFs',
    'advanceSearchIndexRequest',
    'searchIndexRequestOwns',
    'searchIndexStatusNeedsUpdate',
    'searchIndexActionFailureMessage',
    `${hookCode}\nreturn useProjectSearchIndexActions;`,
  )(
    fakeReact.React,
    callFs,
    advanceRequest,
    requestOwns,
    statusNeedsUpdate,
    failureMessage,
  );
}

const waitForAutomaticUpdate = () => new Promise((resolve) => setTimeout(resolve, 250));

test('index percentage is bounded and unknown totals never fake completion', () => {
  const percent = loadSearchIndexFunction('searchIndexProgressPercent');
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(0, 500), 0);
  assert.equal(percent(120, 500), 24);
  assert.equal(percent(500, 500), 100);
  assert.equal(percent(700, 500), 100);
  assert.equal(percent(-20, 500), 0);
});

test('opening a project starts one cancellable incremental index update', async () => {
  const fakeReact = createFakeReact();
  const operations = [];
  let rebuildSignal = null;
  let resolveRebuild;
  const callFs = (payload, options) => {
    operations.push(payload.op);
    if (payload.op === 'searchIndexStatus')
      return Promise.resolve({ exists: false, rebuilding: false, watcherActive: true });
    if (payload.op === 'updateSearchIndex') {
      rebuildSignal = options.signal;
      return new Promise((resolve) => {
        resolveRebuild = resolve;
      });
    }
    throw new Error(`unexpected operation: ${payload.op}`);
  };
  const hook = loadSearchIndexHook(fakeReact, callFs);
  const render = () => {
    fakeReact.resetCursor();
    return hook(
      () => {},
      (key) => key,
      { excludedDirectories: [], includedDirectories: [] },
      '/workspace',
    );
  };

  const actions = render();
  await waitForAutomaticUpdate();
  assert.equal(operations.includes('updateSearchIndex'), true);
  assert.equal(render().rebuilding, true);
  assert.notEqual(rebuildSignal, null);
  actions.cancel();
  assert.equal(rebuildSignal.aborted, true);
  resolveRebuild({ files: 0, contentBytes: 0, truncated: false });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(render().rebuilding, false);
});

test('a complete existing index is still incrementally updated, never treated as a full rebuild', async () => {
  const fakeReact = createFakeReact();
  const operations = [];
  let updateSignal = null;
  const callFs = (payload, options) => {
    operations.push(payload.op);
    if (payload.op === 'searchIndexStatus') {
      return Promise.resolve({
        exists: true,
        rebuilding: false,
        watcherActive: true,
        processedFiles: 1,
        totalFiles: 2,
      });
    }
    if (payload.op === 'updateSearchIndex') {
      updateSignal = options.signal;
      return new Promise(() => {});
    }
    throw new Error(`unexpected operation: ${payload.op}`);
  };
  const hook = loadSearchIndexHook(fakeReact, callFs);
  const render = () => {
    fakeReact.resetCursor();
    return hook(
      () => {},
      (key) => key,
      { excludedDirectories: [], includedDirectories: [] },
      '/workspace',
    );
  };

  render();
  await waitForAutomaticUpdate();
  assert.equal(operations.includes('updateSearchIndex'), true);
  assert.equal(operations.includes('rebuildSearchIndex'), false);
  assert.notEqual(updateSignal, null);
  const actions = render();
  actions.cancel();
  assert.equal(updateSignal.aborted, true);
});

test('a watcher-verified complete index skips the automatic update request', async () => {
  const fakeReact = createFakeReact();
  const operations = [];
  const callFs = (payload) => {
    operations.push(payload.op);
    if (payload.op === 'searchIndexStatus') {
      return Promise.resolve({
        exists: true,
        rebuilding: false,
        watcherActive: true,
        pathScanComplete: true,
        directoryScanComplete: true,
        contentScanVerified: true,
        processedFiles: 0,
        totalFiles: 0,
      });
    }
    throw new Error(`unexpected operation: ${payload.op}`);
  };
  const hook = loadSearchIndexHook(fakeReact, callFs);
  fakeReact.resetCursor();
  hook(
    () => {},
    (key) => key,
    { excludedDirectories: [], includedDirectories: [] },
    '/verified-workspace',
  );

  await waitForAutomaticUpdate();
  assert.equal(operations.includes('updateSearchIndex'), false);
  assert.equal(operations.includes('rebuildSearchIndex'), false);
});

test('the Host keeps its workspace watcher warm across quick Editor re-entry', () => {
  assert.match(host, /WORKSPACE_WATCHER_IDLE_CLOSE_MS = 30 \* 60 \* 1000/u);
  const response = host.slice(
    host.indexOf('function workspaceWatchResponse('),
    host.indexOf('function encodeSse('),
  );
  assert.match(response, /let detached = false/u);
  assert.match(response, /if \(detached\) return/u);
  assert.match(response, /detached = true/u);
  assert.match(response, /setTimeout\(\(\) => \{\s*watcher\?\.close\(\);/u);
});

test('Project owns the visible index progress strip and automatic prebuild wiring', () => {
  assert.match(panel, /data-dsh-project-index-progress=''/u);
  assert.match(panel, /role='progressbar'/u);
  assert.match(panel, /data-dsh-index-cancel=''/u);
  assert.match(panel, /searchIndexPrebuildProgress/u);
  assert.match(panel, /ariaBusy=\{uploadBusy \|\| searchIndexRebuilding \|\| searchIndexClearing/u);
  assert.match(
    workspace,
    /useProjectSearchIndexActions\(flashStatus, t, searchDirectoryRules, root\)/u,
  );
  assert.match(workspace, /searchIndexRebuilding=\{projectSearchIndexActions\.rebuilding\}/u);
  assert.match(workspace, /onCancelSearchIndex=\{projectSearchIndexActions\.cancel\}/u);
  for (const key of [
    'searchIndexUpdating',
    'searchIndexUpdateProgress',
    'searchIndexUpdateDone',
    'searchIndexUpdateTruncated',
    'searchIndexPrebuilding',
    'searchIndexPrebuildProgress',
    'searchIndexPrebuildingShort',
    'searchIndexProgressShort',
    'searchIndexCancelShort',
  ]) {
    assert.equal((locales.match(new RegExp(`${key}:`, 'g')) ?? []).length, 2, `${key} must exist twice`);
  }
});
