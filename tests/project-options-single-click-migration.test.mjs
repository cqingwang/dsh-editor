import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  loadTypeScriptModule,
  transpileTypeScriptFunction,
} from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const optionsSource = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const localesSource = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');

function loadSingleClickPreference(storedValue, legacyValue) {
  const storage = new Map([
    ['dsh-editor.project.singleClickOpen', storedValue],
    ['dsh-editor.project.autoscrollToSource', legacyValue],
  ]);
  const writes = [];
  const removals = [];
  const readStoredText = (key, fallback) => storage.get(key) ?? fallback;
  const window = {
    localStorage: {
      setItem: (key, value) => {
        storage.set(key, value);
        writes.push([key, value]);
      },
      removeItem: (key) => {
        storage.delete(key);
        removals.push(key);
      },
    },
  };
  const code = [
    transpileTypeScriptFunction(terminalSource, 'projectSingleClickPreference'),
    transpileTypeScriptFunction(terminalSource, 'readProjectSingleClickOpen'),
  ].join('\n');
  return new Function(
    'readStoredText',
    'window',
    'storage',
    'writes',
    'removals',
    `${code}\nreturn { projectSingleClickPreference, readProjectSingleClickOpen, storage, writes, removals };`,
  )(readStoredText, window, storage, writes, removals);
}

test('AutoscrollToSource legacy state maps to the unified single-click preference', () => {
  const { projectSingleClickPreference } = loadSingleClickPreference('0', '0');
  assert.equal(projectSingleClickPreference('0', '0'), false);
  assert.equal(projectSingleClickPreference('1', '0'), true);
  assert.equal(projectSingleClickPreference('0', '1'), true);
  assert.equal(projectSingleClickPreference('1', '1'), true);
});

test('legacy AutoscrollToSource storage is consumed as a migration source', () => {
  const migrated = loadSingleClickPreference('0', '1');
  assert.equal(migrated.readProjectSingleClickOpen(), true);
  assert.deepEqual(migrated.writes, [['dsh-editor.project.singleClickOpen', '1']]);
  assert.deepEqual(migrated.removals, ['dsh-editor.project.autoscrollToSource']);
  assert.equal(migrated.storage.get('dsh-editor.project.singleClickOpen'), '1');
  assert.equal(migrated.storage.has('dsh-editor.project.autoscrollToSource'), false);

  const disabled = loadSingleClickPreference('0', '0');
  assert.equal(disabled.readProjectSingleClickOpen(), false);
  assert.deepEqual(disabled.writes, []);
  assert.deepEqual(disabled.removals, []);
});

test('Project exposes IDEA AutoscrollToSource as one unified single-click action', () => {
  assert.match(
    workspaceSource,
    /const \[\s*singleClickOpen,\s*setSingleClickOpen,\s*\]\s*=\s*React\.useState\(readProjectSingleClickOpen\)/,
  );
  assert.match(workspaceSource, /const toggleSingleClickOpen = React\.useCallback\(/);
  assert.match(
    workspaceSource,
    /window\.localStorage\.setItem\('dsh-editor\.project\.singleClickOpen', next \? '1' : '0'\)/,
  );
  assert.doesNotMatch(workspaceSource, /const \[autoScrollToSource, setAutoScrollToSource\]/);
  assert.doesNotMatch(workspaceSource, /const toggleAutoScrollToSource = React\.useCallback/);
  assert.doesNotMatch(workspaceSource, /window\.localStorage\.setItem\('dsh-editor\.project\.autoscrollToSource'/);

  const { projectOptionsMenu } = loadTypeScriptModule(optionsSource, ['projectOptionsMenu']);
  const menu = projectOptionsMenu({
    t: (key) => key,
    position: { x: 0, y: 0 },
    expandAllAvailable: true,
    previewTabEnabled: false,
    singleClickOpen: false,
    openDirectoriesSingleClick: false,
    showExcludedFiles: false,
    compactDirectories: false,
    showHidden: true,
    sortMode: 'name',
    manualOrderEmpty: true,
    foldersFirst: true,
    onRefresh() {},
    onGotoFile() {},
    onRecentFiles() {},
    onExpandAll() {},
    onTogglePreviewTab() {},
    onToggleSingleClickOpen() {},
    onToggleOpenDirectoriesSingleClick() {},
    onToggleShowExcludedFiles() {},
    onToggleCompactDirectories() {},
    onToggleHidden() {},
    onApplySortMode() {},
    onResetManualOrder() {},
    onToggleFoldersFirst() {},
  });
  const behavior = menu.items.find((item) => item?.id === 'behavior');
  assert.ok(Array.isArray(behavior?.items));
  assert.deepEqual(
    behavior.items.filter((item) => item !== null).map((item) => item.id),
    ['previewTab', 'singleClickOpen', 'openDirectoriesSingleClick'],
  );
  assert.equal(behavior.items.some((item) => item?.id === 'autoscrollToSource'), false);
});

test('the IDEA UI wording exists in both dictionaries', () => {
  assert.ok(localesSource.includes("openFilesSingleClick: '单击打开文件'"));
  assert.ok(localesSource.includes("openFilesSingleClick: 'Open Files with Single Click'"));
});
