import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('Find in Files popup uses IDEA dialog dimensions instead of a wide sheet', () => {
  const popup = source.slice(source.indexOf('findToolPopup: {'), source.indexOf('findToolToolbar: {'));
  assert.match(source, /FIND_POPUP_DEFAULT_WIDTH = 510/u);
  assert.match(source, /FIND_POPUP_DEFAULT_HEIGHT = 440/u);
  assert.doesNotMatch(popup, /(?:^|\s)(?:width|height):/u);
  assert.doesNotMatch(popup, /width: 'min\(780px/);
});

test('Find in Files popup uses flat result rows and reserves the tree for the dock', () => {
  assert.match(
    findTool,
    /const popupOccurrences = React\.useMemo\([\s\S]*?\.\.\.scopedFileResults\.map[\s\S]*?\.\.\.scopedMatches\.map/u,
  );
  assert.match(findTool, /const occurrences(?::\s*[^=]+)? = floating \? popupOccurrences : dockVisibleRows\.rows/);
  assert.match(findTool, /floating[\s\S]*?data-dsh-find-popup-result/);
  assert.match(findTool, /displayGroups\.map[\s\S]*?data-dsh-find-group/);
});

test('Find in Files popup auto-previews the active text hit', () => {
  assert.match(findTool, /React\.useState\(true\)/);
  assert.match(findTool, /previewOpen && \(floating \? active !== null && hasFindToolContentQuery\(query\) : true\)/);
  assert.match(findTool, /styles\.findToolPreviewPane/);
});

test('Find in Files popup keeps the query row to query, history and search filters', () => {
  const searchRowStart = findTool.indexOf('styles.findToolPopupSearchRow');
  const searchRowEnd = findTool.indexOf('{replaceExpanded ? (', searchRowStart);
  assert.ok(searchRowStart >= 0 && searchRowEnd > searchRowStart);
  const searchRow = findTool.slice(searchRowStart, searchRowEnd);
  assert.match(searchRow, /findClearSearch/);
  assert.match(searchRow, /floating === false[\s\S]*?findToolShowReplace/);
  assert.match(searchRow, /data-dsh-find-search-new-line/);
});

test('Find in Files popup headers keep only filter and pin actions', () => {
  assert.match(findTool, /const popupHeaderActions = toolbarActions\.filter/);
  assert.match(findTool, /actions=\{floating \? popupHeaderActions : toolbarActions\}/u);
});

test('Find occurrence preview style is not overwritten by the preview pane style', () => {
  const keys = [...source.matchAll(/^      findToolPreview(?:Pane)?: \{/gmu)].map((match) => match[0]);
  assert.equal(keys.filter((key) => key.includes('findToolPreview:')).length, 1);
  assert.match(source, /^      findToolPreviewPane: \{/mu);
});
