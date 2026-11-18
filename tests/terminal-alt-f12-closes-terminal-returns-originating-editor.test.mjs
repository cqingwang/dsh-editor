import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compactActionBarSource } from './ui-sources.mjs';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const screenSource = readFileSync(
  join(root, 'src/client/components/terminal/TerminalScreen.tsx'),
  'utf8',
);
const commitPanelSource = readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source = [
  workspaceSource,
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8'),
  screenSource,
  commitPanelSource,
  readFileSync(join(root, 'src/client/ui/styles.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/foundation.ts'), 'utf8'),
].join('\n');
const entryIconSource = readFileSync(join(root, 'src/client/components/ui/EntryIcon.tsx'), 'utf8');
const fileBadgeSource = readFileSync(join(root, 'src/client/components/ui/file-badge.ts'), 'utf8');
const diffSource = readFileSync(join(root, 'src/client/diff.ts'), 'utf8');

function slice(from, to) {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `${from} is missing`);
  const end = source.indexOf(to, start);
  assert.notEqual(end, -1, `${to} is missing after ${from}`);
  return source.slice(start, end);
}

const splitChanges = loadTypeScriptFunction(diffSource, 'splitChanges');

/** The collapse keys Collapse All must write for a git snapshot. */
function collapseKeys(changes) {
  const all = new Set();
  const bands = splitChanges(changes);
  for (const [id, entries] of Object.entries(bands)) {
    if (entries.length === 0) continue;
    all.add(`${id}:`);
    for (const change of entries) {
      for (let index = change.path.indexOf('/'); index >= 0; index = change.path.indexOf('/', index + 1)) {
        all.add(`${id}:${change.path.slice(0, index)}`);
      }
    }
  }
  return all;
}

test('Alt+F12 closes from the terminal and returns to the originating editor', () => {
  const toggle = slice('const toggleTerminalDock = () => {', 'const onKeyDown = (event) => {');
  const restore = slice('const restoreTerminalOrigin = () => {', 'const toggleTerminalDock = () => {');
  assert.match(toggle, /terminalShortcutAction\(/);
  assert.match(toggle, /document\.activeElement instanceof Element/);
  assert.match(toggle, /if \(action\.open === false\) \{/);
  assert.match(toggle, /if \(action\.restoreFocus\) restoreTerminalOrigin\(\);/);
  assert.match(restore, /const previous = terminalReturnFocusRef\.current;/);
  assert.match(restore, /previous instanceof HTMLElement && previous\.isConnected/);
  assert.match(restore, /previous\.focus\(\)/);
});

test('opening the dock remembers Monaco or the focused tree/list control', () => {
  const start = source.lastIndexOf('const rememberTerminalOrigin = () => {');
  const keys = source.slice(start, source.indexOf("}, [selectActivity, terminalOpen]);", start));
  assert.match(keys, /terminalReturnFocusRef\.current =\s+current !== null/);
  assert.match(keys, /current\.closest\('\[data-dsh-editor-terminal\]'\) === null/);
  assert.match(keys, /setTerminalOpen\(true\)/);
  assert.match(keys, /setTerminalFocusGeneration\(\(value\) => value \+ 1\)/);
});

test('the dock only reclaims focus when the terminal is genuinely visible', () => {
  const screen = screenSource;
  assert.match(screen, /const \[visible, setVisible\] = React\.useState\(false\);/);
  assert.match(screen, /node\.offsetParent !== null/);
  assert.match(screen, /if \(!ready\) return;[\s\S]*?emulatorRef\.current\?\.focus\(\);[\s\S]*?\}, \[ready, visible, focusGeneration\]\);/);
});

test('the Commit action bar exposes IDEA Select Opened / Expand / Collapse', () => {
  const panel = commitPanelSource;
  assert.match(panel, /label: t\('editor\.selectOpenedChange'\)/);
  assert.match(panel, /label: t\('editor\.expandChanges'\)/);
  assert.match(panel, /label: t\('editor\.collapseChanges'\)/);
  assert.match(panel, /onSelectOpenedChange\?\.\(\)/);
  assert.match(panel, /onExpandChanges\?\.\(\)/);
  assert.match(panel, /onCollapseChanges\?\.\(\)/);
});

test('Select Opened File uses the staged side of a mixed change', () => {
  const wiring = workspaceSource.slice(
    workspaceSource.indexOf('onSelectOpenedChange={() => {'),
    workspaceSource.indexOf('onExpandChanges={() => {'),
  );
  assert.match(wiring, /const path = activePathRef\.current;/);
  assert.match(wiring, /change\.path === path/);
  assert.match(wiring, /candidate\.status\[0\] !== ' ' && candidate\.status\[0\] !== '\?'/);
  assert.match(wiring, /chooseChange\(\{ path, staged \}, \{\}\)/);
  assert.match(wiring, /`\$\{staged \? 'staged' : 'unstaged'\}:\$\{path\}`/);
});

test('Expand and Collapse All persist the Changes tree state', () => {
  const expand = workspaceSource.slice(
    workspaceSource.indexOf('onExpandChanges={() => {'),
    workspaceSource.indexOf('onCollapseChanges={() => {'),
  );
  assert.match(expand, /setCollapsedGroups\(new Set\(\)\)/);
  assert.match(expand, /writeCollapsedGroups\(rootRef\.current, new Set\(\)\)/);
  const collapse = workspaceSource.slice(
    workspaceSource.indexOf('onCollapseChanges={() => {'),
    workspaceSource.indexOf('onRollbackSelected='),
  );
  assert.match(collapse, /const bands = splitChanges\(changesNow\)/);
  assert.match(collapse, /all\.add\(`\$\{id\}:`\)/);
  assert.match(collapse, /index = change\.path\.indexOf\('\/', index \+ 1\)/);
  assert.match(collapse, /setCollapsedGroups\(all\)/);
  assert.match(collapse, /writeCollapsedGroups\(rootRef\.current, all\)/);
});

test('Collapse All derives directory keys from the git model, not rendered rows', () => {
  const changes = [
    { path: 'sample.txt', status: 'MM' },
    { path: 'second.txt', status: ' M' },
    { path: 'src/nested/deep.ts', status: '??' },
  ];
  assert.deepEqual([...collapseKeys(changes)], [
    'staged:',
    'unstaged:',
    'unversioned:',
    'unversioned:src',
    'unversioned:src/nested',
  ]);
});

test('Change group names keep their intrinsic width in the narrow tool window', () => {
  const label = slice('commitGroupLabel: {', 'commitGroupCount: {');
  assert.match(label, /flex: 'none'/);
  assert.match(label, /minWidth: 'max-content'/);
  assert.match(label, /whiteSpace: 'nowrap'/);
  assert.doesNotMatch(label, /textOverflow: 'ellipsis'/);
});

test('the action strip measures the pane width instead of shrink-wrapping its actions', () => {
  const bar = slice('commitActionBar: {', 'commitActionSpacer: {');
  assert.match(bar, /width: '100%'/);
  assert.match(bar, /boxSizing: 'border-box'/);
  const compact = compactActionBarSource;
  assert.match(compact, /new ResizeObserver\(measure\)/);
  assert.match(compact, /const next = actions\.length <= slots \? actions\.length : Math\.max\(0, slots - 1\)/);
  assert.match(compact, /\}, \[actionSlotWidth, actionsKey, visibleCount\]\);/);
  assert.match(compact, /id: action\.id,\n\s+label: action\.label,\n\s+shortcut: action\.active === true \? '✓' : '',\n\s+disabled: action\.disabled === true,\n\s+active: typeof action\.active === 'boolean' \? action\.active : undefined,\n\s+run: \(\) => action\.onClick\?\.\(\)/);
});

test('the tree prefers the host file artwork and keeps the badge fallback', () => {
  assert.match(source, /require\('@deepseek-ai\/dsh-client-ui-primitives'\)/);
  assert.match(entryIconSource, /primitives\?\.FileTypeIcon/);
  assert.match(entryIconSource, /<HostFileTypeIcon[\s\S]*?path=\{entry\.path\}[\s\S]*?size=\{16\}/);
  assert.match(entryIconSource, /const badge = fileBadge\(entry\.path\);/);
  assert.match(fileBadgeSource, /export function fileBadge\(/);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-primitives'));
  assert.match(manifest.peerDependencies['@deepseek-ai/dsh-client-ui-primitives'], /0\.2\.2-rc\.1/);
});
