import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fixture = await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8');
const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const showUsagesSource = await readFile(new URL('../src/client/components/search/ShowUsagesPopup.tsx', import.meta.url), 'utf8');
const popupStart = showUsagesSource.indexOf('function ShowUsagesPopup(');
const popup = showUsagesSource.slice(popupStart);

test('Show Usages rows reuse the shared result context menu', () => {
  assert.notEqual(popupStart, -1);
  assert.match(popup, /searchResultContextItems\(\{/);
  assert.match(popup, /onOpenInRightSplit:/);
  assert.match(popup, /onRevealResult:/);
  assert.match(popup, /onNotify,/);
  assert.match(popup, /resultMenu === null \? null : \(\s*<ContextMenu/u);
});

test('a usage row opens its menu on right click without activating the row', () => {
  assert.match(popup, /onContextMenu=\{\(event\) => openUsageMenu\(event, match\)\}/u);
  assert.match(popup, /openUsageMenuAt\(event\.clientX, event\.clientY, match\)/);
  assert.match(popup, /event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)/);
});

test('ContextMenu and Shift+F10 open the active usage menu from query or list', () => {
  assert.match(popup, /event\.key === 'ContextMenu'/);
  assert.match(popup, /event\.shiftKey === true && event\.key === 'F10'/);
  assert.match(popup, /openUsageMenuAt\(rect\?\.left \?\? 20, rect\?\.bottom \?\? 20, active\)/);
});

test('copy actions keep the popup while navigation actions close it', () => {
  const invocationStart = source.indexOf('React.createElement(ShowUsagesPopup, {');
  const invocationEnd = source.indexOf('searchEverywhere === null', invocationStart);
  const invocation = source.slice(invocationStart, invocationEnd);
  assert.match(invocation, /onNotify: \(message\) => flashStatus\(message\)/);
  assert.match(
    invocation,
    /onOpenInRightSplit: \(path, location\) => \{[\s\S]*?closeShowUsages\(\);[\s\S]*?openInRightSplit\(path, location\)/,
  );
  assert.match(invocation, /onRevealResult: \(path\) => \{[\s\S]*?closeShowUsages\(\);[\s\S]*?revealPath\(path\)/);
  assert.doesNotMatch(popup, /id: 'copyRelative'[\s\S]*?onClose\(\)/);
  assert.doesNotMatch(popup, /id: 'copyLocation'[\s\S]*?onClose\(\)/);
});
