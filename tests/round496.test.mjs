import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function findTool() {
  const start = source.indexOf('function FindToolWindow(');
  const end = source.indexOf('function QuickOpen(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Search Everywhere and Find share one result context menu model', () => {
  assert.match(source, /function searchResultContextItems\(\{/);
  assert.match(source, /function copySearchResultText\(text, onNotify, t\)/);
  assert.match(source, /t\('editor\.openInRightSplit'\)/);
  assert.match(source, /t\('editor\.openInEditor'\)/);
  assert.match(source, /t\('editor\.copyRelativePath'\)/);
  assert.match(source, /t\('editor\.copyPathWithLineIdea'\)/);
  assert.match(source, /t\('editor\.revealInProject'\)/);
});

test('Find rows expose mouse and keyboard context menu entry points', () => {
  const panel = findTool();
  assert.match(panel, /const \[resultMenu, setResultMenu\] = React\.useState\(null\)/);
  assert.match(panel, /const openFindResultMenuAt = \(x, y, result\) =>/);
  assert.match(panel, /items: searchResultContextItems\(\{/);
  assert.match(panel, /onContextMenu: \(event\) => \{/);
  assert.match(panel, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
  assert.match(panel, /openFindResultMenuAt\(rect\?\.left \?\? 20, rect\?\.bottom \?\? 20, result\)/);
});

test('Find context actions keep the tool window open and preserve active descendant', () => {
  const panel = findTool();
  assert.match(panel, /onOpenEditor: \(\) => openFindResult\(result\)/);
  assert.match(panel, /onOpenInRightSplit: \(\) => onOpenInRightSplit\([\s\S]{0,100}result\.path[\s\S]{0,140}result\.kind === 'text'/);
  assert.match(panel, /onRevealResult: \(\) => onRevealResult\(result\.path\)/);
  assert.doesNotMatch(panel, /onOpenInRightSplit: \(\) => \{[\s\S]{0,120}onClose\(\)/);
  assert.match(panel, /'aria-activedescendant': active === null \? undefined : findToolOptionId\(active\.rowKey\)/);
});

test('Editor wires Find context actions to the existing editor surfaces', () => {
  const start = source.indexOf('React.createElement(FindToolWindow');
  assert.notEqual(start, -1);
  const render = source.slice(start, start + 12000);
  assert.match(render, /onOpenInRightSplit: \(path, location\) => void openInRightSplit\(path, location\)/);
  assert.match(render, /onRevealResult: \(path\) => void revealPath\(path\)/);
  assert.match(render, /onNotify: \(message\) => flashStatus\(message\)/);
});
