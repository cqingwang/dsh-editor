import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = [
  await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8'),
].join('\n');
const findTool = source.slice(
  source.indexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;'),
);

test('Rerun remembers the active result until the new generation finishes', () => {
  assert.match(findTool, /const rerunSelectionRef = React\.useRef\(null\)/);
  assert.match(findTool, /const rerunFindSearch = \(\) => \{/);
  assert.match(findTool, /rowKey: active\.rowKey/);
  assert.match(findTool, /path: active\.path/);
  assert.match(findTool, /index: activeIndex/);
  assert.match(findTool, /generation: \(state\.searchGeneration \?\? 0\) \+ 1/);
  assert.match(findTool, /if \(target\.generation !== state\.searchGeneration\) return/);
  assert.match(findTool, /state\.loadedGeneration !== state\.searchGeneration/);
  assert.match(findTool, /onClick: rerunFindSearch/);
});

test('Rerun restores collapsed groups and preview without clearing context', () => {
  assert.match(findTool, /if \(targetIndex < 0 && collapsedFiles\.has\(target\.path\)\)[\s\S]*?next\.delete\(target\.path\)/);
  assert.match(findTool, /const restoredIndex = targetIndex >= 0 \? targetIndex : target\.index/);
  assert.match(findTool, /onMove\(0, occurrences\.length, Math\.min\(restoredIndex, occurrences\.length - 1\)\)/);
  assert.match(findTool, /rerunSelectionRef\.current !== null && state\.loading === true[\s\S]*?return undefined/);
});

test('Preview Source is a direct dock action', () => {
  const previewAction = findTool.slice(
    findTool.indexOf("id: 'preview'"),
    findTool.indexOf("id: 'filterSearch'"),
  );
  assert.match(previewAction, /pinned: !floating/);
  assert.match(findTool, /id: 'preview'[\s\S]*?pinned: !floating/u);
  assert.match(source, /findToolDockHeaderActions: \{[\s\S]*?width: 158/);
});

test('Open results in new tab keeps text location and leaves the dock alive', () => {
  const openResult = findTool.slice(
    findTool.indexOf('const openFindResult = (result'),
    findTool.indexOf('React.useEffect(() => {', findTool.indexOf('const openFindResult = (result')),
  );
  assert.match(openResult, /onOpen\(result, openResultsInNewTab === true\)/);
  assert.doesNotMatch(openResult, /onClose\(\)/);
  assert.match(
    source,
    /if \(openInNewTab\)[\s\S]*?void openInRightSplit\(\s*result\.path,\s*result\.kind === 'text'[\s\S]*?line: result\.line,\s*column: result\.column,/,
  );
  assert.match(findTool, /readStoredText\('dsh-editor\.find\.openInNewTab', '0'\) === '1'/);
  assert.match(findTool, /localStorage\.setItem\('dsh-editor\.find\.openInNewTab', next \? '1' : '0'\)/);
});
