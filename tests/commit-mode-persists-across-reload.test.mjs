import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');

test('Commit Changes/Log mode initializes from a normalized stored preference', () => {
  assert.match(
    workspaceSource,
    /const \[commitMode, setCommitMode\] = React\.useState<'changes' \| 'log'>\(\(\) =>\s+readStoredText\('dsh-editor\.commit\.mode', 'changes'\) === 'log' \? 'log' : 'changes',\s+\);/u,
  );
  assert.match(terminalSource, /export function writeStoredText\(key: string, value: string\): void/u);
});

test('every Commit mode transition persists the selected tab', () => {
  const switchStart = workspaceSource.indexOf('const switchCommitMode = React.useCallback(');
  const switchEnd = workspaceSource.indexOf('/**', switchStart);
  assert.ok(switchStart >= 0 && switchEnd > switchStart, 'switchCommitMode is missing');
  const switchBlock = workspaceSource.slice(switchStart, switchEnd);
  assert.match(switchBlock, /writeStoredText\('dsh-editor\.commit\.mode', next\)/u);
  assert.match(switchBlock, /setCommitMode\(next\)/u);
  assert.doesNotMatch(workspaceSource, /setCommitMode\('log'\)/u);
});
