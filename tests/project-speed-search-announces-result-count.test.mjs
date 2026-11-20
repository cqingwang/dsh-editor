import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);
const message = await readFile(
  new URL('../src/client/components/ui/TreeMessage.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('TreeMessage can announce status without adding a visual row', () => {
  assert.match(message, /visuallyHidden\?: boolean;/u);
  assert.match(message, /className=\{visuallyHidden \? 'dsh-editor-visually-hidden' : undefined\}/u);
});

test('Project speed search announces positive result counts', () => {
  assert.match(
    panel,
    /searchOpen && search\.trim\(\) !== '' && searchError === null && searchPending !== true && hits\.length > 0/u,
  );
  assert.match(
    panel,
    /hits\.length === 1 \? 'editor\.treeSearchResultCountOne' : 'editor\.treeSearchResultCount'/u,
  );
  assert.match(panel, /<TreeMessage\s+state='search-results'\s+visuallyHidden=\{true\}>/u);
});

test('search result count copy is localized in singular and plural forms', () => {
  assert.match(locales, /treeSearchResultCount: '找到 \{count\} 个项目',/u);
  assert.match(locales, /treeSearchResultCountOne: '找到 1 个项目',/u);
  assert.match(locales, /treeSearchResultCount: '\{count\} project items found',/u);
  assert.match(locales, /treeSearchResultCountOne: '1 project item found',/u);
});
