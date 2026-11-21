import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('disabled Replace actions explain why they cannot run', () => {
  assert.match(findTool, /const replaceDisabledReasons = findReplaceDisabledReasons\(\{/u);
  assert.match(findTool, /replaceBusy: state\.replaceBusy/u);
  assert.match(findTool, /loading: state\.loading/u);
  assert.match(findTool, /error: state\.error/u);
  assert.match(findTool, /matchCount: scopedMatches\.length/u);
  assert.match(findTool, /activeKind: active\?\.kind/u);
  assert.match(findTool, /const replaceAllDisabledReason = replaceDisabledReasons\.all/u);
  assert.match(findTool, /const replaceCurrentDisabledReason = replaceDisabledReasons\.current/u);
  assert.match(findTool, /title=\{replaceAllDisabledReason \|\|/u);
  assert.match(findTool, /aria-description=\{replaceAllDisabledReason \|\| undefined\}/u);
  assert.match(findTool, /title=\{replaceCurrentDisabledReason \|\|/u);
  assert.match(findTool, /aria-description=\{replaceCurrentDisabledReason \|\| undefined\}/u);
});

test('disabled Replace reason copy is localized', () => {
  assert.match(source, /findReplaceAllDisabled: '当前范围没有可替换的匹配项'/u);
  assert.match(source, /findReplaceCurrentDisabled: '请先选择一个文本匹配项'/u);
  assert.match(source, /findReplaceBusy: '正在执行替换，请稍候'/u);
  assert.match(source, /findReplaceLoading: '搜索结果仍在加载'/u);
  assert.match(source, /findReplaceAllDisabled: 'No replaceable matches in the current scope'/u);
  assert.match(source, /findReplaceCurrentDisabled: 'Select a text match to replace'/u);
  assert.match(source, /findReplaceBusy: 'A replacement is already running'/u);
  assert.match(source, /findReplaceLoading: 'Search results are still loading'/u);
});
