import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
);

test('Find error copy wraps unbroken host messages inside the popup width', () => {
  const start = source.indexOf('searchEverywhereError: {');
  const end = source.indexOf('\n      },', start);
  const style = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(style, /minWidth: 0/u);
  assert.match(style, /maxWidth: '100%'/u);
  assert.match(style, /overflowWrap: 'anywhere'/u);
  assert.match(style, /wordBreak: 'break-word'/u);
});

test('The visible alert is the single error announcement', () => {
  assert.match(findTool, /const findResultStatus = state\.error !== null\s+\? ''\s+: state\.loading === true/u);
  assert.match(findTool, /state\.error !== null[\s\S]*?role: 'alert'[\s\S]*?t\('editor\.findSearchFailed', \{ message: state\.error \}\)/u);
  assert.match(source, /findSearchFailed: '搜索失败：\{message\}'/u);
  assert.match(source, /findSearchFailed: 'Search failed: \{message\}'/u);
});
