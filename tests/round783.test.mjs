import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function treeMenu() {
  const start = source.indexOf('const buildTreeMenu = React.useCallback(');
  const end = source.indexOf('/* Move one entry into a directory', start);
  assert.ok(start >= 0 && end > start, 'Project tree menu should exist');
  return source.slice(start, end);
}

test('Project file context menu has no Open in Editor action', () => {
  const menu = treeMenu();
  assert.doesNotMatch(menu, /t\('editor\.openInEditor'\)/u);
  assert.doesNotMatch(menu, /id: 'open',[\s\S]*?t\('editor\.openInEditor'\)/u);
});

test('Project directory menu still exposes Expand Directory', () => {
  const menu = treeMenu();
  assert.match(menu, /isDirectory\s*\?\s*\[\s*\{[\s\S]*?label: t\('editor\.expandFolder'\)/u);
  assert.match(menu, /toggleDirectory\(row\.path\)/u);
});

test('Project split action is labelled Split Open without changing shared menus', () => {
  const menu = treeMenu();
  assert.match(menu, /label: t\('editor\.openInSplit'\)/u);
  assert.match(source, /openInSplit: '分屏打开',/u);
  assert.match(source, /openInSplit: 'Open in Split',/u);
  assert.match(source, /openInRightSplit: '在右侧拆分部分打开',/u);
  assert.match(source, /openInRightSplit: 'Open in Right Split',/u);
});
