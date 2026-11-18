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

test('host Undo Last Replace restores the exact clean-file transaction', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round699-undo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = join(root, 'a.ts');
  const second = join(root, 'b.ts');
  await writeFile(first, 'needle one\nneedle two\n', 'utf8');
  await writeFile(second, 'needle three\n', 'utf8');
  const firstInfo = await stat(first);
  const secondInfo = await stat(second);

  const replaced = await host.replaceWorkspaceText(
    root,
    'needle',
    'omega',
    [
      { path: 'a.ts', mtime: firstInfo.mtimeMs },
      { path: 'b.ts', mtime: secondInfo.mtimeMs },
    ],
    {},
  );
  assert.equal(replaced.changedFiles, 2);
  assert.equal(replaced.replacements, 3);
  assert.equal(await readFile(first, 'utf8'), 'omega one\nomega two\n');
  assert.equal(await readFile(second, 'utf8'), 'omega three\n');

  const undone = await host.undoLastWorkspaceReplacement(root);
  assert.equal(undone.changedFiles, 2);
  assert.equal(undone.replacements, 3);
  assert.equal(await readFile(first, 'utf8'), 'needle one\nneedle two\n');
  assert.equal(await readFile(second, 'utf8'), 'needle three\n');
  await assert.rejects(
    () => host.undoLastWorkspaceReplacement(root),
    /no recent replacement/u,
  );
});

test('Undo Last Replace refuses to overwrite a file changed after replacement', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round699-conflict-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = join(root, 'a.ts');
  const second = join(root, 'b.ts');
  await writeFile(first, 'needle\n', 'utf8');
  await writeFile(second, 'needle\n', 'utf8');
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
  await writeFile(second, 'externally changed\n', 'utf8');

  await assert.rejects(
    () => host.undoLastWorkspaceReplacement(root),
    /changed after replacement/u,
  );
  assert.equal(await readFile(first, 'utf8'), 'omega\n');
  assert.equal(await readFile(second, 'utf8'), 'externally changed\n');
});

test('Find exposes Undo Last Replace only while a replacement snapshot exists', () => {
  assert.match(source, /id: 'undoReplace'/);
  assert.match(source, /label: t\('editor\.findUndoLastReplace'\)/);
  assert.match(source, /disabled: canUndoLastReplace !== true \|\| state\.replaceBusy === true/);
  assert.match(source, /canUndoLastReplace=\{findReplaceUndoStack\.length > 0\}/);
  assert.match(source, /onUndoLastReplace=\{\(\) => void undoFindReplace\(\)\}/);
  assert.match(source, /findUndoLastReplace: '撤销上次替换'/);
  assert.match(source, /findUndoLastReplace: 'Undo Last Replace'/);
});

test('Undo validates dirty buffers before host rollback and clears stale operations', () => {
  const undo = source.slice(
    source.indexOf('const undoFindReplace = React.useCallback'),
    source.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(undo, /model\.getValue\(\) !== entry\.afterContent/);
  assert.match(undo, /callFs\(\{\s+op: 'undoReplaceText',\s+operationId: operation\.operationId,\s+\}\)/);
  assert.match(undo, /commitFindToolDirtyPlans\(dirtyPlans\)/);
  assert.match(undo, /setFindReplaceUndoStack\(\(current\) => current\.slice\(0, -1\)\)/);
  assert.match(undo, /setFindReplaceRedoStack\(\(current\) => boundedReplaceHistory\(current, operation\)\)/);
  assert.match(undo, /reloadFile\(path\)/);
  assert.match(source, /op: 'undoReplaceText'/);
  assert.match(hostSource, /undoReplaceText: undoLastWorkspaceReplacement/);
});
