import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const opener = source.slice(
  source.indexOf('const openFindTool = React.useCallback'),
  source.indexOf('const openFindToolInDock = React.useCallback'),
);

test('opening Find explicitly restores focus to its content query', () => {
  assert.match(opener, /window\.setTimeout\(\(\) => \{/);
  assert.match(opener, /const target = findToolFocusSelector\(surface, focusTarget\)/);
  assert.match(opener, /document\.querySelector<HTMLElement>\(target\)\?\.focus\?\.\(\)/);
});

test('keyboard-open Find runs after the tool window state update', () => {
  assert.ok(opener.indexOf('else setFindTool(nextFindTool)') < opener.indexOf('const target ='));
});

test('the focus restore does not create another search or reset request state', () => {
  const focusBlock = opener.slice(opener.indexOf('window.setTimeout'), opener.indexOf('}, []);'));
  assert.doesNotMatch(focusBlock, /callFs|searchFindHandoff|setFindTool/);
});
