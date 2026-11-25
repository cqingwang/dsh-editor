import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const hookSource = read('src/client/components/editor/use-diff-focus-layout.ts');
const diffSource = read('src/client/components/diff/DiffPreview.tsx');
const areaSource = read('src/client/components/editor/EditorDiffArea.tsx');
const workspaceSource = read('src/client/editor-workspace.tsx');
const localeSource = read('src/client/locales.ts');

test('Focus Diff temporarily saves and restores chat and tool-window state', () => {
  assert.match(hookSource, /export function useDiffFocusLayout\(/u);
  assert.match(hookSource, /restoreRef\.current = \{ chatCollapsed: harnessCollapsed, panelVisible \}/u);
  assert.match(hookSource, /if \(panelVisible\) setPanelVisible\(false\)/u);
  assert.match(hookSource, /if \(!harnessCollapsed\) toggleHarness\(\)/u);
  assert.match(hookSource, /if \(!diffOpen && diffFocusMode\) exitDiffFocus\(\)/u);
  assert.match(hookSource, /restore\.chatCollapsed === false && harnessCollapsed === false/u);
  assert.match(hookSource, /if \(!diffFocusMode \|\| panelVisible !== true\) return/u);
  assert.match(hookSource, /exitDiffFocus\(\{ restorePanel: false \}\)/u);
});

test('Diff toolbar exposes Focus Diff as a real toggle action', () => {
  assert.match(diffSource, /focusMode\?: boolean/u);
  assert.match(diffSource, /onToggleFocus\?: \(\) => void/u);
  assert.match(diffSource, /id: 'focusDiff'/u);
  assert.match(diffSource, /icon: focusMode \? 'collapse' : 'expand'/u);
  assert.match(diffSource, /label: focusMode \? t\('editor\.diffExitFocus'\) : t\('editor\.diffFocus'\)/u);
  assert.match(diffSource, /active: focusMode/u);
  assert.match(diffSource, /run: onToggleFocus/u);
});

test('EditorDiffArea and EditorWorkspace wire the focus layout state', () => {
  assert.match(areaSource, /focusMode\?: boolean/u);
  assert.match(areaSource, /onToggleFocus\?: \(\) => void/u);
  assert.match(areaSource, /focusMode=\{focusMode\}/u);
  assert.match(areaSource, /onToggleFocus=\{onToggleFocus\}/u);
  assert.match(workspaceSource, /useDiffFocusLayout\(\{/u);
  assert.match(workspaceSource, /diffOpen: diffTarget !== null && diffActive/u);
  assert.match(workspaceSource, /focusMode=\{diffFocusMode\}/u);
  assert.match(workspaceSource, /onToggleFocus=\{toggleDiffFocus\}/u);
});

test('Focus Diff copy exists in both dictionaries', () => {
  for (const key of ['diffFocus', 'diffExitFocus']) {
    const matches = [...localeSource.matchAll(new RegExp(`${key}:`, 'g'))];
    assert.equal(matches.length, 2, `${key} must exist once in zh and once in en`);
  }
});
