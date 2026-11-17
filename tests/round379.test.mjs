import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function buildTreeMenuBlock() {
  const start = source.indexOf('const buildTreeMenu = React.useCallback(');
  const end = source.indexOf('/* Move one entry into a directory by drag-and-drop', start);
  assert.ok(start >= 0 && end > start, 'buildTreeMenu should exist');
  return source.slice(start, end);
}

test('filtered Project views expose row-specific Select in Project View', () => {
  const menu = buildTreeMenuBlock();
  assert.match(menu, /label: isDirectory[\s\S]*?editor\.expandFolder[\s\S]*?filteredView[\s\S]*?editor\.revealInProject/);
  assert.match(menu, /disabled: isDirectory === false && filteredView !== true/);
  assert.match(menu, /run: \(\) => \{[\s\S]*?if \(isDirectory\)[\s\S]*?void revealPath\(row\.path\)/);
});

test('the row-specific reveal action is wired into buildTreeMenu dependencies', () => {
  const menu = buildTreeMenuBlock();
  const dependencies = menu.slice(menu.lastIndexOf('[compareWithClipboard'));
  assert.match(dependencies, /filteredView/);
  assert.match(dependencies, /revealPath/);
});

test('Open Files remains a stable projection of tab order with no stale rows', () => {
  const start = source.indexOf("normalized === 'openFiles'");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 500);
  assert.match(block, /Array\.isArray\(openFiles\) \? openFiles : \[\]/);
  assert.match(block, /map\(\(file\) => file\?\.path\)/);
  assert.doesNotMatch(block, /localStorage/);
});

test('explicit row reveal opens Project without an automatic follow pass', () => {
  const revealStart = source.indexOf('const revealPath = React.useCallback(');
  const revealEnd = source.indexOf('const revealPath = React.useCallback(', revealStart + 1);
  const revealBlock = source.slice(revealStart, revealEnd < 0 ? revealStart + 800 : revealEnd);
  assert.match(revealBlock, /setActivity\('project'\)/);
  assert.match(revealBlock, /setPanelVisible\(true\)/);
  assert.match(revealBlock, /await revealInProjectTree\(path\)/);
  assert.doesNotMatch(source, /suppressAutoScrollRef/);
  assert.doesNotMatch(source, /void revealInProjectTree\(activePath\)/);
});
