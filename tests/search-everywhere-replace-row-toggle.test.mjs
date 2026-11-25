import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const commit = await readFile(new URL('src/client/commit.ts', root), 'utf8');
const searchEverywhere = await readFile(new URL('src/client/components/search/SearchEverywhere.tsx', root), 'utf8');
const workspace = await readFile(new URL('src/client/editor-workspace.tsx', root), 'utf8');
const locales = await readFile(new URL('src/client/locales.ts', root), 'utf8');

test('Search Everywhere exposes a real Replace toggle instead of an unreachable row', () => {
  assert.match(searchEverywhere, /onToggleReplace: \(\) => void;/u);
  assert.match(searchEverywhere, /id: 'replace',\s+icon: 'replace',\s+label: t\('editor\.searchReplaceToggle'\),/u);
  assert.match(searchEverywhere, /disabled: effectiveTab !== 'all' && effectiveTab !== 'text'/u);
  assert.match(searchEverywhere, /const toggleReplace = \(\): void => \{/u);
  assert.match(
    searchEverywhere,
    /if \(!next\) window\.setTimeout\(\(\) => searchInputRef\.current\?\.focus\?\.\(\), 0\);/u,
  );
  assert.match(searchEverywhere, /const previousReplaceBusyRef = React\.useRef\(replaceBusy\);/u);
  assert.match(searchEverywhere, /if \(!wasBusy \|\| replaceBusy \|\| state\.withReplace !== true\) return;/u);
  assert.match(workspace, /onToggleReplace=\{\(\) => setSearchEverywhere\(searchEverywhereReplaceToggleState\)\}/u);
  assert.match(locales, /searchReplaceToggle: '替换'/u);
  assert.match(locales, /searchReplaceToggle: 'Replace'/u);
});

test('toggling Replace opens the row and requests replacement focus', () => {
  const toggle = loadTypeScriptFunction(commit, 'searchEverywhereReplaceToggleState');
  const opened = toggle({ query: 'needle', withReplace: false, replaceFocusRequest: 2 });
  assert.equal(opened.withReplace, true);
  assert.equal(opened.replaceFocusRequest, 3);
  const closed = toggle(opened);
  assert.equal(closed.withReplace, false);
  assert.equal(closed.replaceFocusRequest, 3);
  assert.equal(toggle(null), null);
});

test('a successful Replace All returns focus to the replacement input', () => {
  const success = loadTypeScriptFunction(commit, 'searchEverywhereReplaceSuccessState');
  const current = { withReplace: true, replaceFocusRequest: 4, textRevision: 2 };
  const next = success(current, true);
  assert.equal(next.replaceFocusRequest, 5);
  assert.equal(next.textRevision, 3);
  const stale = success(current, false);
  assert.equal(stale.replaceFocusRequest, 4);
});
