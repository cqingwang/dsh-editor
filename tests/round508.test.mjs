import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const opener = source.slice(source.indexOf('const openFindTool = React.useCallback'), source.indexOf('React.useEffect(() => {\n        if (searchEverywhere !== null) writeSearchOptions'));

test('opening Find explicitly restores focus to its content query', () => {
  assert.match(opener, /window\.setTimeout\(\(\) => \{/);
  assert.match(opener, /\[data-dsh-find-tool-window\] input\[role="combobox"\]/);
  assert.match(opener, /\.focus\?\.\(\)/);
});

test('keyboard-open Find runs after the tool window state update', () => {
  assert.ok(
    opener.indexOf('setFindTool({') < opener.indexOf('[data-dsh-find-tool-window] input[role="combobox"]'),
  );
});

test('the focus restore does not create another search or reset request state', () => {
  const focusBlock = opener.slice(opener.indexOf('window.setTimeout'), opener.indexOf('}, []);'));
  assert.doesNotMatch(focusBlock, /callFs|searchFindHandoff|setFindTool/);
});
