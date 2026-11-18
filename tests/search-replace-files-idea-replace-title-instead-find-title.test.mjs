import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('Replace in Files uses the IDEA replace title instead of the find title', () => {
  assert.match(findTool, /state\.mode === 'replace'/);
  assert.match(findTool, /t\(replaceMode \? 'editor\.replaceInFilesTitle' : 'editor\.findInFilesTitle'\)/);
  assert.match(source, /replaceInFilesTitle: '在文件中替换'/);
  assert.match(source, /replaceInFilesTitle: 'Replace in Files'/);
});

test('The popup Replace row keeps New Line beside Preserve case', () => {
  const replaceRow = findTool.slice(
    findTool.indexOf('styles.findToolReplaceRow'),
    findTool.indexOf('styles.findToolScopeRow', findTool.indexOf('styles.findToolReplaceRow')),
  );
  assert.doesNotMatch(replaceRow, /floating === false/);
  assert.match(replaceRow, /checked=\{replaceNewLine\}/);
  assert.match(replaceRow, /findNewLine/);
  assert.match(replaceRow, /<Icon\s+name='replace'\s+size=\{13\}\s+\/>/u);
  assert.match(replaceRow, /icon=\{floating \? 'chevronDown' : 'history'\}/u);
  assert.match(replaceRow, /icon='preserveCase'/);
});

test('Replace mode keeps the same flat popup chrome and bottom actions', () => {
  assert.match(findTool, /const popupOccurrences(?::\s*[^=]+)? = \[/);
  assert.match(findTool, /actions=\{floating \? popupHeaderActions : toolbarActions\}/u);
  assert.match(findTool, /t\('editor\.searchReplaceAll'\)/);
  assert.match(findTool, /t\('editor\.replaceCurrent'\)/);
});
