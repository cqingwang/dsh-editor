import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const modelSource = await readFile(
  new URL('../src/client/components/terminal/editor-terminal-tabs.ts', import.meta.url),
  'utf8',
);
const areaSource = await readFile(
  new URL('../src/client/components/terminal/EditorTerminalArea.tsx', import.meta.url),
  'utf8',
);
const tabSource = await readFile(
  new URL('../src/client/components/terminal/EditorTerminalTab.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const {
  editorTerminalActiveAfterChange,
  editorTerminalTabTargetIndex,
  editorTerminalsWithMetadata,
  updateEditorTerminalMetadata,
} = loadTypeScriptModule(modelSource, [
  'editorTerminalActiveAfterChange',
  'editorTerminalTabTargetIndex',
  'editorTerminalsWithMetadata',
  'updateEditorTerminalMetadata',
]);

test('newly moved terminals become active without hiding earlier placements', () => {
  assert.equal(editorTerminalActiveAfterChange([], [{ id: 'a' }], null), 'a');
  assert.equal(editorTerminalActiveAfterChange(['a'], [{ id: 'a' }, { id: 'b' }], 'a'), 'b');
  assert.equal(editorTerminalActiveAfterChange(['a', 'b'], [{ id: 'a' }, { id: 'b' }], 'a'), 'a');
});

test('removing the active editor terminal falls back to a surviving placement', () => {
  assert.equal(editorTerminalActiveAfterChange(['a', 'b'], [{ id: 'a' }], 'b'), 'a');
  assert.equal(editorTerminalActiveAfterChange(['a'], [], 'a'), null);
});

test('the editor terminal surface renders one tab per moved PTY', () => {
  assert.match(areaSource, /terminals: EditorTerminalDescriptor\[\]/u);
  assert.match(areaSource, /onSelectTerminal=\{selectTerminal\}/u);
  assert.match(tabSource, /terminals\.map\(\(entry\) => \(/u);
  assert.match(tabSource, /role='tablist'/u);
  assert.match(tabSource, /role='tab'/u);
  assert.match(tabSource, /data-dsh-editor-terminal-tab-id=\{entry\.id\}/u);
  assert.match(tabSource, /onClick=\{\(\) => onSelectTerminal\?\.\(entry\.id\)\}/u);
  assert.match(workspaceSource, /<EditorTerminalArea[\s\S]*?terminals=\{editorTerminals\}/u);
  assert.doesNotMatch(workspaceSource, /terminal=\{editorTerminals\[editorTerminals\.length - 1\] \?\? null\}/u);
});

test('editor terminal tabs use roving keyboard navigation', () => {
  assert.equal(editorTerminalTabTargetIndex(1, 3, 'ArrowLeft'), 0);
  assert.equal(editorTerminalTabTargetIndex(1, 3, 'ArrowRight'), 2);
  assert.equal(editorTerminalTabTargetIndex(2, 3, 'ArrowRight'), 0);
  assert.equal(editorTerminalTabTargetIndex(0, 3, 'ArrowLeft'), 2);
  assert.equal(editorTerminalTabTargetIndex(1, 3, 'Home'), 0);
  assert.equal(editorTerminalTabTargetIndex(1, 3, 'End'), 2);
  assert.equal(editorTerminalTabTargetIndex(1, 3, 'Enter'), null);
  assert.match(tabSource, /tabIndex=\{entry\.id === activeTerminalId \? 0 : -1\}/u);
  assert.match(tabSource, /editorTerminalTabTargetIndex\(/u);
  assert.match(tabSource, /onSelectTerminalFromKeyboard/u);
  assert.match(tabSource, /window\.setTimeout\([\s\S]*?dataset\.dshEditorTerminalTabId === next\.id/u);
  assert.match(tabSource, /className='dsh-editor-terminal-tab'/u);
});

test('the selected editor terminal survives reload without stealing new placements', () => {
  assert.match(areaSource, /React\.useState<string \| null>\(\(\) => readEditorTerminalActiveId\(\)\)/u);
  assert.match(
    areaSource,
    /if \(activeId !== null && terminals\.some\(\(terminal\) => terminal\.id === activeId\)\)[\s\S]*?previousIdsRef\.current = terminals\.map\(\(terminal\) => terminal\.id\)/u,
  );
  assert.match(areaSource, /writeEditorTerminalActiveId\(activeId\)/u);
  assert.equal(editorTerminalActiveAfterChange(['a', 'b'], [{ id: 'a' }, { id: 'b' }], 'a'), 'a');
});

test('Escape leaves the editor terminal tablist for the terminal input', () => {
  assert.match(tabSource, /event\.key === 'Escape'/u);
  assert.match(
    tabSource,
    /event\.key === 'Escape'[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?emulator\?\.focus\(\)/u,
  );
});

test('Editor terminals follow OSC title and cwd without replacing the PTY identity', () => {
  const terminals = [{ id: 'term', title: 'Shell', cwd: '/repo' }];
  const metadata = updateEditorTerminalMetadata({}, 'term', { title: 'npm test', cwd: '/repo/src' });
  assert.deepEqual(editorTerminalsWithMetadata(terminals, metadata), [
    { id: 'term', title: 'npm test', cwd: '/repo/src' },
  ]);
  assert.equal(updateEditorTerminalMetadata(metadata, 'term', { title: 'npm test' }), metadata);
  assert.match(areaSource, /callTerminal\(\{ op: 'rename', id, title: cleaned, auto: true \}\)/u);
  assert.match(areaSource, /onTitle=\{updateTitle\}/u);
  assert.match(areaSource, /onCwd=\{\(id, cwd\) => updateMetadata\(id, \{ cwd \}\)\}/u);
});
