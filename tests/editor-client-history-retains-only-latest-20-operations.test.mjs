import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const host = await import('../lib/index.js');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source = [
  await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  commitSource,
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
].join('\n');
const hostSource = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

function extractFunction(name) {
  return transpileTypeScriptFunction(commitSource, name);
}

const boundedReplaceHistory = new Function(
  `${extractFunction('replaceHistoryTextBytes')}\n${extractFunction('boundedReplaceHistory')}\nreturn boundedReplaceHistory;`,
)();

async function replaceOnce(root, relativePath, query, replacement) {
  const info = await stat(join(root, relativePath));
  return host.replaceWorkspaceText(
    root,
    query,
    replacement,
    [{ path: relativePath, mtime: info.mtimeMs }],
    {},
  );
}

test('client history retains only the latest 20 operations', () => {
  let history = [];
  for (let index = 0; index < 21; index += 1) {
    history = boundedReplaceHistory(history, { id: String(index), dirty: [] });
  }
  assert.deepEqual(history.map((operation) => operation.id), Array.from({ length: 20 }, (_, index) => String(index + 1)));
});

test('client history enforces the byte budget and drops an oversized latest operation', () => {
  const history = boundedReplaceHistory([], {
    id: 'oversized',
    dirty: [{ beforeContent: '123456', afterContent: '' }],
  }, 20, 5);
  assert.deepEqual(history, []);

  const retained = boundedReplaceHistory([
    {
      id: 'old',
      dirty: [{ beforeContent: '1234', afterContent: '' }],
    },
  ], {
    id: 'latest',
    dirty: [{ beforeContent: '1234567', afterContent: '' }],
  }, 20, 10);
  assert.deepEqual(retained.map((operation) => operation.id), ['latest']);
});

test('host clean operations support continuous Undo and Redo with operation ids', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round701-stack-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = 'value.txt';
  await writeFile(join(root, file), 'token-0', 'utf8');

  const first = await replaceOnce(root, file, 'token-0', 'token-1');
  const second = await replaceOnce(root, file, 'token-1', 'token-2');
  const third = await replaceOnce(root, file, 'token-2', 'token-3');
  assert.equal(typeof first.operationId, 'string');
  assert.equal(typeof second.operationId, 'string');
  assert.equal(typeof third.operationId, 'string');

  await host.undoLastWorkspaceReplacement(root, third.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-2');
  await host.undoLastWorkspaceReplacement(root, second.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-1');
  await host.undoLastWorkspaceReplacement(root, first.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-0');

  await host.redoLastWorkspaceReplacement(root, first.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-1');
  await host.redoLastWorkspaceReplacement(root, second.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-2');
  await host.redoLastWorkspaceReplacement(root, third.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-3');
});

test('host history evicts the oldest operation after the 20-operation limit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round701-count-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const operations = [];
  for (let index = 0; index <= 20; index += 1) {
    const relativePath = `file-${index}.txt`;
    await writeFile(join(root, relativePath), 'needle', 'utf8');
    operations.push(await replaceOnce(root, relativePath, 'needle', 'omega'));
  }

  for (let index = 20; index >= 1; index -= 1) {
    await host.undoLastWorkspaceReplacement(root, operations[index].operationId);
    assert.equal(await readFile(join(root, `file-${index}.txt`), 'utf8'), 'needle');
  }
  assert.equal(await readFile(join(root, 'file-0.txt'), 'utf8'), 'omega');
  await assert.rejects(
    () => host.undoLastWorkspaceReplacement(root, operations[0].operationId),
    /no recent replacement to undo/u,
  );
});

test('a new Replace truncates the redo branch', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round701-branch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = 'value.txt';
  await writeFile(join(root, file), 'token-0', 'utf8');

  const first = await replaceOnce(root, file, 'token-0', 'token-1');
  const second = await replaceOnce(root, file, 'token-1', 'token-2');
  await host.undoLastWorkspaceReplacement(root, second.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-1');

  const branch = await replaceOnce(root, file, 'token-1', 'token-3');
  await assert.rejects(
    () => host.redoLastWorkspaceReplacement(root, second.operationId),
    /no recent replacement to redo/u,
  );
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-3');

  await host.undoLastWorkspaceReplacement(root, branch.operationId);
  await host.undoLastWorkspaceReplacement(root, first.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-0');
});

test('an older or stale operation id is rejected without changing the file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round701-id-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = 'value.txt';
  await writeFile(join(root, file), 'token-0', 'utf8');

  const first = await replaceOnce(root, file, 'token-0', 'token-1');
  const second = await replaceOnce(root, file, 'token-1', 'token-2');
  await assert.rejects(
    () => host.undoLastWorkspaceReplacement(root, first.operationId),
    /replacement history changed before undo/u,
  );
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-2');
  await host.undoLastWorkspaceReplacement(root, second.operationId);
  assert.equal(await readFile(join(root, file), 'utf8'), 'token-1');
});

test('host history evicts old operations when the 16 MiB byte budget is exceeded', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round701-bytes-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const padding = 'x'.repeat(999_990);
  const operations = [];
  for (let index = 0; index < 9; index += 1) {
    const relativePath = `large-${index}.txt`;
    await writeFile(join(root, relativePath), `${padding}NEEDLE-${index}`, 'utf8');
    operations.push(await replaceOnce(root, relativePath, `NEEDLE-${index}`, `OMEGA-${index}`));
  }

  for (let index = 8; index >= 1; index -= 1) {
    await host.undoLastWorkspaceReplacement(root, operations[index].operationId);
  }
  assert.equal((await readFile(join(root, 'large-0.txt'), 'utf8')).endsWith('OMEGA-0'), true);
  await assert.rejects(
    () => host.undoLastWorkspaceReplacement(root, operations[0].operationId),
    /no recent replacement to undo/u,
  );
});

test('client replace records gate host Undo on a stable operation id', () => {
  const replaceAll = source.slice(
    source.indexOf('const replaceInFindTool = React.useCallback'),
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  );
  const replaceOne = source.slice(
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
    source.indexOf('const undoFindReplace = React.useCallback'),
  );
  for (const operationSource of [replaceAll, replaceOne]) {
    assert.match(operationSource, /const operationId = typeof value\?\.operationId === 'string' \? value\.operationId : ''/);
    assert.match(operationSource, /operationId,/);
    assert.match(operationSource, /clean: operationId !== '' &&/);
  }
  assert.match(replaceAll, /clean: operationId !== '' && hostChanged\.length > 0/);
  assert.match(replaceOne, /clean: operationId !== '' && dirtyFile === undefined && changed\.length > 0/);
  assert.match(replaceAll, /dirty: dirtyUndo,/);
  assert.match(replaceOne, /dirty:\s*dirtyFile !== undefined && dirtyRewrite !== null && dirtyBeforeContent !== null/);
});

test('Undo and Redo status messages use the plural-aware count placeholders', () => {
  assert.match(source, /findUndoReplaceDone: '已撤销 \{matches\} 处替换，共 \{files\} 个文件'/);
  assert.match(source, /findRedoReplaceDone: '已重做 \{matches\} 处替换，共 \{files\} 个文件'/);
  assert.match(source, /findUndoReplaceDone: 'Undid \{matches\} \{matchUnit\} in \{files\} \{fileUnit\}'/);
  assert.match(source, /findRedoReplaceDone: 'Redid \{matches\} \{matchUnit\} in \{files\} \{fileUnit\}'/);
});

test('starting a new branch releases redo bytes before applying the history budget', () => {
  const start = hostSource.indexOf('function clearReplaceHistoryRedo(');
  assert.notEqual(start, -1, 'clearReplaceHistoryRedo is missing');
  const bodyStart = hostSource.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let index = bodyStart; index < hostSource.length; index += 1) {
    if (hostSource[index] === '{') depth += 1;
    if (hostSource[index] === '}') depth -= 1;
    if (depth === 0) {
      end = index + 1;
      break;
    }
  }
  assert.notEqual(end, -1, 'clearReplaceHistoryRedo has no closing brace');
  const clearReplaceHistoryRedo = new Function(
    `${hostSource.slice(start, end)}; return clearReplaceHistoryRedo;`,
  )();
  const history = {
    undo: [{ id: 'kept', bytes: 7 }],
    redo: [{ id: 'branch', bytes: 3 }, { id: 'older', bytes: 2 }],
    bytes: 12,
  };
  clearReplaceHistoryRedo(history);
  assert.deepEqual(history.redo, []);
  assert.equal(history.bytes, 7);
});
