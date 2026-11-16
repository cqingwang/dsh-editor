import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('function QuickOpen('),
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
  assert.match(replaceRow, /checked: replaceNewLine/);
  assert.match(replaceRow, /findNewLine/);
  assert.match(replaceRow, /React\.createElement\(Icon, \{ name: 'replace', size: 13 \}\)/);
  assert.match(replaceRow, /icon: floating \? 'chevronDown' : 'history'/);
  assert.match(replaceRow, /icon: 'preserveCase'/);
});

test('Replace mode keeps the same flat popup chrome and bottom actions', () => {
  assert.match(findTool, /const popupOccurrences = \[/);
  assert.match(findTool, /actions: floating \? popupHeaderActions : toolbarActions/);
  assert.match(findTool, /t\('editor\.searchReplaceAll'\)/);
  assert.match(findTool, /t\('editor\.replaceCurrent'\)/);
});
