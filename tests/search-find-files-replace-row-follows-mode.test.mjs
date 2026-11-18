import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('Find in Files opens Find-only while Replace mode exposes the Replace row', () => {
  assert.match(findTool, /const \[searchNewLine, setSearchNewLine\] = React\.useState\(false\)/);
  assert.match(findTool, /const \[replaceNewLine, setReplaceNewLine\] = React\.useState\(false\)/);
  assert.match(findTool, /const \[replaceExpanded, setReplaceExpanded\] = React\.useState\(\(\) => state\.mode === 'replace'\)/);
  assert.match(findTool, /replaceExpanded \? \(\s*<div style=\{styles\.findToolReplaceRow\}/u);
  assert.match(findTool, /label=\{replaceExpanded \? t\('editor\.findToolHideReplace'\) : t\('editor\.findToolShowReplace'\)\}/u);
  assert.match(findTool, /data-dsh-find-replace-input=''/);
  assert.ok(findTool.indexOf('styles.findToolSearchRow') < findTool.indexOf('styles.findToolReplaceRow'));
});

test('Search and Replace support New Line mode with textarea controls', () => {
  assert.match(findTool, /const QueryField = searchNewLine \? 'textarea' : 'input';/);
  assert.match(findTool, /const ReplaceField = replaceNewLine \? 'textarea' : 'input';/);
  assert.match(findTool, /searchNewLine && event\.key === 'Enter'/);
  assert.match(findTool, /replaceNewLine &&\s+event\.key === 'Enter'/u);
  assert.match(findTool, /checked=\{searchNewLine\}/);
  assert.match(findTool, /checked=\{replaceNewLine\}/);
  assert.match(findTool, /findToolMultilineInput/);
  assert.equal((source.match(/findNewLine: '换行'/g) ?? []).length, 1);
  assert.equal((source.match(/findNewLine: 'New Line'/g) ?? []).length, 1);
});

test('Preserve case is part of the Replace row', () => {
  const replaceRow = findTool.slice(
    findTool.indexOf('styles.findToolReplaceRow'),
    findTool.indexOf('state.error !== null', findTool.indexOf('styles.findToolReplaceRow')),
  );
  assert.match(replaceRow, /icon='preserveCase'/);
  assert.match(replaceRow, /label=\{t\('editor\.searchPreserveCase'\)\}/u);
  assert.match(replaceRow, /active=\{state\.preserveCase === true\}/u);
  assert.match(replaceRow, /onClick=\{onTogglePreserveCase\}/u);
  const toolbar = findTool.slice(findTool.indexOf('const toolbarActions = ['), findTool.indexOf("data-dsh-find-bottom-bar=''"));
  assert.doesNotMatch(toolbar, /id: 'preserveCase'/);
});

test('Find in Files popup remains bounded at narrow viewports', () => {
  assert.match(source, /findToolPopup: \{[\s\S]*?width: 'min\(510px, calc\(100vw - 24px\)\)'[\s\S]*?height: 'min\(440px, calc\(100vh - 32px\)\)'/);
  assert.doesNotMatch(source, /findToolPopup: \{[\s\S]*?0 0 0 100vmax rgba\(0, 0, 0, 0\.18\)/);
  assert.match(source, /findToolSearchRow: \{[\s\S]*?flexWrap: 'wrap'/);
  assert.match(source, /findToolReplaceRow: \{[\s\S]*?flexWrap: 'wrap'/);
  assert.match(source, /findToolScopeRow: \{[\s\S]*?flexWrap: 'wrap'/);
});
