import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(source, ['toolWindowShortcutAction', 'terminalShortcutAction']);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('a visible inactive tool window is focused before it can be hidden', () => {
  assert.equal(helpers.toolWindowShortcutAction('project', 'project', true, false), 'focus');
  assert.equal(helpers.toolWindowShortcutAction('project', 'project', true, true), 'hide');
  assert.equal(helpers.toolWindowShortcutAction('project', 'project', false, false), 'show');
  assert.equal(helpers.toolWindowShortcutAction('project', 'commit', true, false), 'show');
  assert.deepEqual(helpers.terminalShortcutAction(true, false), {
    open: true,
    restoreFocus: false,
    focus: true,
  });
});

test('Project and Commit shortcuts use focus-aware activation while Terminal shares its toggle', () => {
  assert.match(workspaceSource, /const focusToolWindowContent = React\.useCallback/u);
  assert.match(workspaceSource, /focusSurfaceWhenReady/u);
  assert.match(workspaceSource, /if \(next === 'project'\) return treeRef\.current;/u);
  assert.match(workspaceSource, /changeRowRefs\.current\.get\(key\)/u);
  assert.match(workspaceSource, /selectActivity\(event\.key === '1' \? 'project' : 'commit', \{ keyboard: true \}\)/u);
  assert.match(workspaceSource, /if \(event\.key === '3'\) toggleTerminalDock\(\);/u);
  assert.match(workspaceSource, /if \(action\.focus\) \{[\s\S]*?setTerminalFocusGeneration/u);
  assert.match(workspaceSource, /panelRef=\{toolWindowPanelRef\}/u);
});
