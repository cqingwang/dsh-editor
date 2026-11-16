import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('function QuickOpen('),
);

test('Find in Files hides Replace by default and expands it on demand', () => {
  assert.match(findTool, /const \[searchNewLine, setSearchNewLine\] = React\.useState\(false\)/);
  assert.match(findTool, /const \[replaceNewLine, setReplaceNewLine\] = React\.useState\(false\)/);
  assert.match(findTool, /const \[replaceExpanded, setReplaceExpanded\] = React\.useState\(\(\) => state\.mode === 'replace'\)/);
  assert.match(findTool, /replaceExpanded\s*\?\s*React\.createElement\([\s\S]*?styles\.findToolReplaceRow/);
  assert.match(findTool, /label: replaceExpanded \? t\('editor\.findToolHideReplace'\) : t\('editor\.findToolShowReplace'\)/);
  assert.match(findTool, /'data-dsh-find-replace-input': ''/);
  assert.ok(findTool.indexOf('styles.findToolSearchRow') < findTool.indexOf('styles.findToolReplaceRow'));
});

test('Search and Replace support New Line mode with textarea controls', () => {
  assert.match(findTool, /React\.createElement\(searchNewLine \? 'textarea' : 'input'/);
  assert.match(findTool, /React\.createElement\(replaceNewLine \? 'textarea' : 'input'/);
  assert.match(findTool, /searchNewLine && event\.key === 'Enter'/);
  assert.match(findTool, /replaceNewLine\s+&& event\.key === 'Enter'/);
  assert.match(findTool, /checked: searchNewLine/);
  assert.match(findTool, /checked: replaceNewLine/);
  assert.match(findTool, /findToolMultilineInput/);
  assert.equal((source.match(/findNewLine: '换行'/g) ?? []).length, 1);
  assert.equal((source.match(/findNewLine: 'New Line'/g) ?? []).length, 1);
});

test('Preserve case is part of the Replace row', () => {
  const replaceRow = findTool.slice(
    findTool.indexOf('styles.findToolReplaceRow'),
    findTool.indexOf('state.error !== null', findTool.indexOf('styles.findToolReplaceRow')),
  );
  assert.match(replaceRow, /icon: 'preserveCase'/);
  assert.match(replaceRow, /label: t\('editor\.searchPreserveCase'\)/);
  assert.match(replaceRow, /active: state\.preserveCase === true/);
  assert.match(replaceRow, /onClick: onTogglePreserveCase/);
  const toolbar = findTool.slice(findTool.indexOf('const toolbarActions = ['), findTool.indexOf('React.useEffect(() => {\n        if (handoffRevision'));
  assert.doesNotMatch(toolbar, /id: 'preserveCase'/);
});

test('Find in Files popup remains bounded at narrow viewports', () => {
  assert.match(source, /findToolPopup: \{[\s\S]*?width: 'min\(580px, calc\(100vw - 24px\)\)'[\s\S]*?height: 'min\(536px, calc\(100vh - 32px\)\)'/);
  assert.doesNotMatch(source, /findToolPopup: \{[\s\S]*?0 0 0 100vmax rgba\(0, 0, 0, 0\.18\)/);
  assert.match(source, /findToolSearchRow: \{[\s\S]*?flexWrap: 'wrap'/);
  assert.match(source, /findToolReplaceRow: \{[\s\S]*?flexWrap: 'wrap'/);
  assert.match(source, /findToolScopeRow: \{[\s\S]*?flexWrap: 'wrap'/);
});
