import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const coreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const remapProjectExpandedPaths = new Function(
  `${transpileTypeScriptFunction(coreSource, 'remapPathAfterMove')}\n${transpileTypeScriptFunction(terminalSource, 'remapProjectExpandedPaths')}\nreturn remapProjectExpandedPaths;`,
)();

test('moved directory expansion follows the destination path and descendants', () => {
  const expanded = new Set(['', 'old', 'old/nested', 'other']);
  const next = remapProjectExpandedPaths(expanded, [['old', 'new']]);
  assert.deepEqual([...next], ['', 'new', 'new/nested', 'other']);
});

test('unchanged expansion keeps the same Set', () => {
  const expanded = new Set(['', 'other']);
  assert.equal(remapProjectExpandedPaths(expanded, [['old', 'new']]), expanded);
});

test('rename and move remap expansion before refreshTree', () => {
  const renameStart = source.indexOf('const commitRename = React.useCallback(');
  const rename = source.slice(renameStart, source.indexOf('const selectActivity', renameStart));
  assert.match(rename, /remapProjectExpandedPathsForMoves\(\[\[renameState\.path, next\]\]\)[\s\S]*?await refreshTree\(\)/u);

  const moveStart = source.indexOf('const moveEntry =');
  const move = source.slice(moveStart, source.indexOf('/* Resolve one conflicted file', moveStart));
  assert.match(move, /remapProjectExpandedPathsForMoves\(entries\)[\s\S]*?await refreshTree\(\)/u);
});
