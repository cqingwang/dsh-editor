import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const findTool = await read('src/client/components/search/FindToolWindow.tsx');
const workspace = await read('src/client/editor-workspace.tsx');
const findDockStateHook = await read('src/client/components/editor/use-find-dock-slot-state.ts');
const terminal = await read('src/client/terminal.ts');
const locales = await read('src/client/locales.ts');

test('the Find dock exposes fixed minimize and close controls outside overflow', () => {
  assert.match(terminal, /FIND_TOOL_DOCK_MIN_HEIGHT = 180/u);
  assert.match(terminal, /FIND_TOOL_DOCK_MAX_HEIGHT = 720/u);
  assert.match(terminal, /Math\.max\(FIND_TOOL_DOCK_MIN_HEIGHT, Math\.min\(FIND_TOOL_DOCK_MAX_HEIGHT, next\)\)/u);
  assert.match(findTool, /minimized\?: boolean/u);
  assert.match(findTool, /onMinimize\?: \(\) => void/u);
  assert.match(findTool, /data-dsh-find-window-actions=\{floating \? undefined : ''\}/u);
  assert.match(findTool, /data-dsh-find-window-controls=''/u);
  assert.match(
    findTool,
    /data-dsh-find-window-controls=''[\s\S]*?icon=\{minimized \? 'expand' : 'hide'\}[\s\S]*?onClick=\{onMinimize\}[\s\S]*?icon='close'[\s\S]*?onClick=\{onClose\}/u,
  );
  assert.doesNotMatch(findTool, /id: 'hide',[\s\S]*?icon: 'close'/u);
});

test('the workspace toggles the dock height without deleting Find state', () => {
  assert.match(findDockStateHook, /const \[minimized, setMinimized\] = React\.useState\(false\)/u);
  assert.match(findDockStateHook, /toggleMinimized = React\.useCallback/u);
  assert.match(workspace, /height=\{findDockState\.minimized \? FIND_TOOL_DOCK_MIN_HEIGHT : findToolDockHeight\}/u);
  assert.match(workspace, /minimized=\{findDockState\.minimized\}/u);
  assert.match(workspace, /onMinimize=\{findDockState\.toggleMinimized\}/u);
  assert.match(workspace, /resizable=\{!findDockState\.minimized\}/u);
  assert.match(
    workspace,
    /const closeFindToolWindow = React\.useCallback\(\(\) => \{[\s\S]*?findDockState\.setMinimized\(false\)/u,
  );
});

test('the new window controls are localized in both dictionaries', () => {
  assert.match(locales, /findToolMinimize: '缩小查找结果'/u);
  assert.match(locales, /findToolRestore: '恢复查找结果'/u);
  assert.match(locales, /findToolClose: '关闭查找结果'/u);
  assert.match(locales, /findToolMinimize: 'Minimize Find Results'/u);
  assert.match(locales, /findToolRestore: 'Restore Find Results'/u);
  assert.match(locales, /findToolClose: 'Close Find Results'/u);
});
