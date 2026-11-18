import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = [
  await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
].join('\n');
const hostSource = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

test('Redo Last Replace reapplies the undone clean-file transaction and can Undo again', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round700-redo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = join(root, 'a.ts');
  const second = join(root, 'b.ts');
  await writeFile(first, 'needle one\nneedle two\n', 'utf8');
  await writeFile(second, 'needle three\n', 'utf8');
  const firstInfo = await stat(first);
  const secondInfo = await stat(second);
  await host.replaceWorkspaceText(
    root,
    'needle',
    'omega',
    [
      { path: 'a.ts', mtime: firstInfo.mtimeMs },
      { path: 'b.ts', mtime: secondInfo.mtimeMs },
    ],
    {},
  );

  await host.undoLastWorkspaceReplacement(root);
  assert.equal(await readFile(first, 'utf8'), 'needle one\nneedle two\n');
  assert.equal(await readFile(second, 'utf8'), 'needle three\n');

  const redone = await host.redoLastWorkspaceReplacement(root);
  assert.equal(redone.changedFiles, 2);
  assert.equal(redone.replacements, 3);
  assert.equal(await readFile(first, 'utf8'), 'omega one\nomega two\n');
  assert.equal(await readFile(second, 'utf8'), 'omega three\n');
  await assert.rejects(
    () => host.redoLastWorkspaceReplacement(root),
    /no recent replacement to redo/u,
  );

  await host.undoLastWorkspaceReplacement(root);
  assert.equal(await readFile(first, 'utf8'), 'needle one\nneedle two\n');
  assert.equal(await readFile(second, 'utf8'), 'needle three\n');
});

test('Redo refuses to overwrite a file changed after Undo', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round700-conflict-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'a.ts');
  await writeFile(file, 'needle\n', 'utf8');
  const info = await stat(file);
  await host.replaceWorkspaceText(
    root,
    'needle',
    'omega',
    [{ path: 'a.ts', mtime: info.mtimeMs }],
    {},
  );
  await host.undoLastWorkspaceReplacement(root);
  await writeFile(file, 'changed after undo\n', 'utf8');

  await assert.rejects(
    () => host.redoLastWorkspaceReplacement(root),
    /changed after undo/u,
  );
  assert.equal(await readFile(file, 'utf8'), 'changed after undo\n');
});

test('Find exposes Redo Last Replace through the same bounded action model', () => {
  assert.match(source, /id: 'redoReplace'/);
  assert.match(source, /label: t\('editor\.findRedoLastReplace'\)/);
  assert.match(source, /disabled: canRedoLastReplace !== true \|\| state\.replaceBusy === true/);
  assert.match(source, /canRedoLastReplace=\{findReplaceRedoStack\.length > 0\}/);
  assert.match(source, /onRedoLastReplace=\{\(\) => void redoFindReplace\(\)\}/);
  assert.match(source, /findRedoLastReplace: '重做上次替换'/);
  assert.match(source, /findRedoLastReplace: 'Redo Last Replace'/);
});

test('Undo and Redo alternate the same dirty and host snapshots', () => {
  const undo = source.slice(
    source.indexOf('const undoFindReplace = React.useCallback'),
    source.indexOf('const redoFindReplace = React.useCallback'),
  );
  const redo = source.slice(
    source.indexOf('const redoFindReplace ='),
    source.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(undo, /setFindReplaceRedoStack\(\(current\) => boundedReplaceHistory\(current, operation\)\)/);
  assert.match(undo, /callFs\(\{\s*op: 'undoReplaceText',\s*operationId: operation\.operationId,\s*\}\)/);
  assert.match(redo, /model\.getValue\(\) !== entry\.beforeContent/);
  assert.match(redo, /callFs\(\{\s*op: 'redoReplaceText',\s*operationId: operation\.operationId,\s*\}\)/);
  assert.match(redo, /setFindReplaceUndoStack\(\(current\) => boundedReplaceHistory\(current, operation\)\)/);
  assert.match(redo, /setFindReplaceRedoStack\(\(current\) => current\.slice\(0, -1\)\)/);
  assert.match(source, /op: 'redoReplaceText'/);
  assert.match(hostSource, /redoReplaceText: redoLastWorkspaceReplacement/);
});
