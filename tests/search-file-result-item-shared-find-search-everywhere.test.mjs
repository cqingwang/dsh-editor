import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const component = await read('src/client/components/search/SearchFileResultItem.tsx');
const searchEverywhere = await read('src/client/components/search/SearchEverywhere.tsx');
const findTool = await read('src/client/components/search/FindToolWindow.tsx');
const quickOpen = await read('src/client/components/search/QuickOpen.tsx');
const showUsages = await read('src/client/components/search/ShowUsagesPopup.tsx');
const builtClient = await read('lib/client.js');

test('SearchFileResultItem owns file identity presentation without interaction semantics', () => {
  assert.match(component, /export interface SearchFileResultItemProps/u);
  assert.match(component, /export function SearchFileResultItem/u);
  assert.match(component, /<EntryIcon/u);
  assert.match(component, /<GitStatusBadge/u);
  assert.match(component, /data-dsh-search-file-result-item=''/u);
  assert.doesNotMatch(component, /role='option'/u);
  assert.doesNotMatch(component, /onClick=/u);
  assert.doesNotMatch(component, /onContextMenu=/u);
});

test('Search Everywhere reuses the shared file result item for path-backed rows', () => {
  assert.match(searchEverywhere, /import \{ SearchFileResultItem \} from '\.\/SearchFileResultItem';/u);
  assert.match(searchEverywhere, /<SearchFileResultItem[\s\S]*?path=\{result\.path \?\? ''\}/u);
  assert.match(searchEverywhere, /statusInfo=\{badge\}\s+selected=\{position === activeIndex\}/u);
  assert.match(searchEverywhere, /name=\{result\.title \?\? result\.label \?\? result\.path \?\? ''\}/u);
  assert.match(searchEverywhere, /detail=\{result\.subtitle\}/u);
});

test('Quick Open passes its live active row into the shared status badge', () => {
  assert.match(quickOpen, /<GitStatusBadge\s+selected=\{position === index\}/u);
});

test('Show Usages reuses the shared path result item instead of a uniform file icon', () => {
  assert.match(showUsages, /import \{ SearchFileResultItem \} from '\.\/SearchFileResultItem';/u);
  assert.match(showUsages, /<SearchFileResultItem[\s\S]*?path=\{match\.path\}/u);
  assert.match(showUsages, /name=\{`\$\{match\.path\}:\$\{match\.line\}:\$\{match\.column\}`\}/u);
  assert.match(showUsages, /detail=\{match\.preview \?\? ''\}/u);
  assert.doesNotMatch(showUsages, /<Icon\s+name='file'/u);
});

test('Find popup, dock file row and group header reuse the same item component', () => {
  assert.match(findTool, /import \{ SearchFileResultItem \} from '\.\/SearchFileResultItem';/u);
  assert.ok((findTool.match(/<SearchFileResultItem/gu) ?? []).length >= 3);
  assert.match(findTool, /<SearchFileResultItem[\s\S]*?path=\{result\.path\}/u);
  assert.match(findTool, /<SearchFileResultItem[\s\S]*?path=\{file\.path\}/u);
  assert.match(findTool, /<SearchFileResultItem[\s\S]*?path=\{group\.path\}/u);
});

test('the browser bundle defines SearchFileResultItem before its search consumers', () => {
  const componentIndex = builtClient.indexOf('function SearchFileResultItem(');
  const firstUsageIndex = builtClient.indexOf('React.createElement(SearchFileResultItem');
  assert.ok(componentIndex >= 0);
  assert.ok(firstUsageIndex >= 0);
  assert.ok(componentIndex < firstUsageIndex);
});
