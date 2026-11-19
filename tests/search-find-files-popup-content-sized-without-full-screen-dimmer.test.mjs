import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('Find in Files popup remains content-sized inside the shared backdrop', () => {
  const popup = source.slice(source.indexOf('findToolPopup: {'), source.indexOf('findToolToolbar: {'));
  assert.match(source, /FIND_POPUP_DEFAULT_WIDTH = 510/u);
  assert.match(source, /FIND_POPUP_DEFAULT_HEIGHT = 440/u);
  assert.doesNotMatch(popup, /position:/u);
  assert.doesNotMatch(popup, /(?:^|\s)(?:width|height):/u);
  assert.doesNotMatch(popup, /height: 'min\(680px, 76vh\)'/);
  assert.doesNotMatch(popup, /100vmax/);
});

test('Find in Files keeps filter and pin in the title row', () => {
  assert.match(findTool, /styles\.findToolHeaderActions/);
  assert.doesNotMatch(findTool, /styles\.findToolActionBar/);
  assert.match(findTool, /id: 'filterSearch'[\s\S]*?pinned: true/);
  assert.match(findTool, /id: 'pin'[\s\S]*?pinned: true/);
});

test('Find in Files renders compact scope controls for the active mode only', () => {
  assert.doesNotMatch(findTool, /styles\.findToolScopeLabel/);
  assert.match(findTool, /label: `\$\{t\('editor\.findScopeIn'\)\} \$\{t\('editor\.findScopeProject'\)\}`/);
  assert.doesNotMatch(
    findTool.slice(findTool.indexOf("scopeMode === 'directory'"), findTool.indexOf('state.error !== null')),
    /disabled: true,\s*'aria-label': t\('editor\.findScopeMore'\)/,
  );
});

test('Find in Files only shows replacement actions with the Replace row', () => {
  const bottomBar = findTool.slice(
    findTool.indexOf('styles.findToolBottomBar'),
    findTool.indexOf('filterMenu === null'),
  );
  assert.match(bottomBar, /replaceExpanded \? \(\s*<React\.Fragment>/u);
  assert.match(bottomBar, /t\('editor\.findOpenInFindWindow'\)/);
  assert.match(bottomBar, /⌘⏎/);
  assert.match(bottomBar, /styles\.findToolShortcut/);
});

test('Replace entry points expand the existing Replace row instead of mounting a second editor', () => {
  assert.match(findTool, /const focusReplaceInput = \(\) => \{\s*setReplaceExpanded\(true\)/);
  assert.match(findTool, /const replaceMode = state\.mode === 'replace';/);
  assert.equal((findTool.match(/data-dsh-find-replace-input=''/g) ?? []).length, 1);
});
