import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const [
  editorCoreSource,
  editorWorkspaceSource,
  projectPanelSource,
  fileCandidatesSource,
  quickOpenSource,
  localesSource,
] = await Promise.all([
  readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8'),
  readFile(
    new URL('../src/client/components/search/use-search-everywhere-file-candidates.ts', import.meta.url),
    'utf8',
  ),
  readFile(new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
]);
const { searchTextFailureMessage } = loadTypeScriptModule(editorCoreSource, ['searchTextFailureMessage']);

function translate(key, params = {}) {
  if (key === 'editor.searchGitIgnoreUnavailable') return `git-ignore:${params.message}`;
  return key;
}

test('Git ignore read failures become a localized actionable message', () => {
  const message = searchTextFailureMessage(
    new Error('fatal: index file smaller than expected'),
    translate,
  );
  assert.equal(message, 'git-ignore:index file smaller than expected');
});

test('unrelated search failures retain their original detail', () => {
  assert.equal(searchTextFailureMessage(new Error('network unavailable'), translate), 'network unavailable');
});

test('every search provider routes failures through the shared formatter', () => {
  assert.match(quickOpenSource, /error: searchTextFailureMessage\(failure, t\),/u);
  assert.match(fileCandidatesSource, /error: searchTextFailureMessage\(failure, t\),\s+errorSource: 'files'/u);
  assert.match(editorWorkspaceSource, /error: searchTextFailureMessage\(failure, t\),\s+\},\s+\);/u);
  assert.match(editorWorkspaceSource, /searchReplaceFailureMessage\(failure, hostChanged\.length, t\)/u);
  assert.match(projectPanelSource, /setSearchError\(searchTextFailureMessage\(failure, t\)\)/u);
});

test('the Git ignore failure copy exists in both dictionaries', () => {
  assert.match(localesSource, /searchGitIgnoreUnavailable: '无法读取 Git 忽略规则，搜索已停止：\{message\}'/u);
  assert.match(localesSource, /searchGitIgnoreUnavailable: 'Could not read Git ignore rules; search stopped: \{message\}'/u);
});
