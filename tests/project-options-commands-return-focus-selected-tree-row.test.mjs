import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { menuSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + (readFileSync(join(root, 'lib/client.js'), 'utf8') + '\n' + readFileSync(join(root, 'tests/fixtures/find-tool.legacy.js'), 'utf8')));

function projectOptions() {
  return source.slice(
    source.indexOf('onOpenOptions: (event) => {'),
    source.indexOf('onCreateChange: (value) =>'),
  );
}

test('Project Options commands return focus to the selected tree row', () => {
  assert.match(source, /const focusProjectAfterOption = React\.useCallback\(\(\) => \{/);
  assert.match(source, /const target = row\?\.isConnected === true && row\.tabIndex >= 0 \? row : treeRef\.current;/);
  assert.match(source, /const runProjectOption = React\.useCallback\(\(action\) => \{/);
  assert.match(source, /window\.setTimeout\(focusNow, 120\)/);

  const options = projectOptions();
  for (const id of ['refresh', 'expandAll']) {
    const start = options.indexOf(`id: '${id}'`);
    assert.notEqual(start, -1, `${id} is missing`);
    const row = options.slice(start, start + 1000);
    assert.match(row, /run: \(\) => runProjectOption\(/, `${id} must restore focus`);
    assert.match(row, /restoreFocus: false/, `${id} must suppress the opener restore`);
  }
  assert.match(options, /id: 'singleClickOpen'[\s\S]*?run: \(\) => runProjectOption/);
  assert.match(options, /id: 'openDirectoriesSingleClick'[\s\S]*?run: \(\) => runProjectOption/);
  assert.match(options, /id: 'appearance'[\s\S]*?run: \(\) => runProjectOption/);
  assert.match(options, /id: 'hidden'[\s\S]*?run: \(\) => runProjectOption/);
  assert.match(menuSource, /const skipReturnFocusRef = React\.useRef\(false\);/);
  assert.match(menuSource, /if \(item\.restoreFocus === false\) skipReturnFocusRef\.current = true;/);
  assert.match(menuSource, /if \(skipReturnFocusRef\.current\) return;/);
});

test('palette-opening Project Options keep their own focus target', () => {
  const options = projectOptions();
  assert.match(options, /id: 'gotoFile'[\s\S]*?run: \(\) => void openQuickOpen\(\)/);
  assert.match(options, /id: 'recent'[\s\S]*?run: \(\) => openRecent\(\)/);
  assert.doesNotMatch(options, /id: 'gotoFile'[\s\S]{0,180}runProjectOption/);
  assert.doesNotMatch(options, /id: 'recent'[\s\S]{0,180}runProjectOption/);
});

test('folding unchanged diff regions cannot reset the hunk counter', () => {
  const effectStart = source.indexOf("diff.updateOptions({\n          hideUnchangedRegions:");
  assert.notEqual(effectStart, -1);
  const effectEnd = source.indexOf('}, [collapseUnchanged]);', effectStart);
  assert.notEqual(effectEnd, -1);
  const effect = source.slice(effectStart, effectEnd);
  assert.match(effect, /minimumLineCount: 4/);
  assert.doesNotMatch(effect, /setHunks\(/);
  assert.doesNotMatch(effect, /setDiffTarget\(/);
});

test('Commit toolbar keeps its trailing refresh/hide actions in the right group', () => {
  const start = source.indexOf('React.createElement(PanelToolbar, {', source.indexOf('function CommitPanel('));
  assert.notEqual(start, -1);
  const end = source.indexOf('historyMenu === null', start);
  assert.notEqual(end, -1);
  const toolbar = source.slice(start, end);
  const refresh = toolbar.indexOf("id: 'refresh'");
  const hide = toolbar.indexOf("id: 'hide'");
  assert.ok(refresh >= 0 && hide > refresh, 'refresh then hide must be the trailing actions');
});
