import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('function QuickOpen('),
);

test('Filter Search Results exposes truthful availability', () => {
  assert.match(findTool, /id: 'filterSearch'/);
  assert.match(findTool, /label: t\('editor\.findFilterResults'\)/);
  assert.match(findTool, /const openFilterMenu = \(event\) =>/);
  assert.match(findTool, /id: 'anywhere'/);
  assert.match(findTool, /id: 'comments'[\s\S]*?disabled: true/);
  assert.match(findTool, /id: 'strings'[\s\S]*?disabled: true/);
  assert.match(findTool, /id: 'exceptComments'[\s\S]*?disabled: true/);
  assert.match(findTool, /id: 'exceptStrings'[\s\S]*?disabled: true/);
  assert.match(findTool, /id: 'exceptBoth'[\s\S]*?disabled: true/);
  assert.match(source, /findFilterResults: '筛选搜索结果'/);
  assert.match(source, /findFilterResults: 'Filter Search Results'/);
});

test('Pin Window toggles persisted state and controls outside-click closing', () => {
  assert.match(findTool, /const \[pinned, setPinned\] = React\.useState/);
  assert.match(findTool, /id: 'pin'/);
  assert.match(findTool, /icon: 'pin'/);
  assert.match(findTool, /active: pinned/);
  assert.match(findTool, /dsh-editor\.find\.pinned/);
  assert.match(findTool, /if \(!floating \|\| pinned\) return undefined/);
  assert.match(findTool, /target\?\.closest\('\[data-dsh-find-tool-window\], \[role="menu"\]'\)/);
  assert.match(findTool, /onClose\(\);\n\s+\};/);
  assert.match(source, /findPinWindow: '固定窗口'/);
  assert.match(source, /findUnpinWindow: '取消固定窗口'/);
});

test('Scope row follows Search and Replace rows', () => {
  const searchAt = findTool.indexOf('styles.findToolSearchRow');
  const replaceAt = findTool.indexOf('styles.findToolReplaceRow');
  const scopeAt = findTool.indexOf('styles.findToolScopeRow');
  assert.ok(searchAt >= 0 && replaceAt > searchAt && scopeAt > replaceAt);
});

test('New Line remains enabled alongside scoped replacement', () => {
  assert.match(findTool, /searchNewLine \? 'textarea' : 'input'/);
  assert.match(findTool, /replaceNewLine \? 'textarea' : 'input'/);
  assert.match(findTool, /scopedReplacementPaths/);
  assert.match(findTool, /onReplaceAll\(scopedReplacementPaths\)/);
});
