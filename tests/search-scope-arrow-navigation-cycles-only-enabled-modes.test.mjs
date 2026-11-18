import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const findTool = source.slice(
  source.indexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;'),
);

test('Scope arrow navigation cycles only enabled modes', () => {
  const target = loadTypeScriptFunction(commitSource, 'findToolScopeModeTarget');
  assert.equal(target('project', 'ArrowRight'), 'files');
  assert.equal(target('files', 'ArrowRight'), 'directory');
  assert.equal(target('directory', 'ArrowRight'), 'scope');
  assert.equal(target('scope', 'ArrowRight'), 'project');
  assert.equal(target('project', 'ArrowLeft'), 'scope');
  assert.equal(target('scope', 'ArrowLeft'), 'directory');
  assert.equal(target('directory', 'Home'), 'project');
  assert.equal(target('project', 'End'), 'scope');
  assert.equal(target('files', 'ArrowLeft'), 'project');
  assert.equal(target('unknown', 'ArrowRight'), 'project');
  assert.equal(target('project', 'Enter'), null);
});

test('Find exposes the scope modes as one named keyboard group', () => {
  assert.match(findTool, /role: 'group'/);
  assert.match(findTool, /'aria-label': t\('editor\.findScopeModeGroup'\)/);
  assert.match(findTool, /tabIndex: scopeMode === scope\.id \? 0 : -1/);
  assert.match(findTool, /handleFindScopeModeKeyDown\(event, scope\.id\)/);
  assert.match(findTool, /scopeModeButtonRefs\.current\.get\(mode\)\?\.focus\?\.\(\)/);
  assert.match(findTool, /selectFindScopeMode\(mode\)/);
});

test('Scope group replaces Module with the actionable File mode', () => {
  assert.match(source, /findScopeModeGroup: '搜索范围'/);
  assert.match(source, /findScopeModeGroup: 'Search scope'/);
  const scopeModes = findTool.slice(
    findTool.indexOf('const scopeModeOptions = ['),
    findTool.indexOf('const replaceMode ='),
  );
  assert.match(scopeModes, /id: 'files'[\s\S]*?disabled: false/);
  assert.doesNotMatch(scopeModes, /id: 'module'/);
  assert.match(source, /findScopeFile: '文件'/);
  assert.match(source, /findScopeFile: 'File'/);
  assert.match(
    source.slice(source.indexOf('function findToolScopeModeTarget('), source.indexOf('function claimReplaceAttempt(')),
    /'files'/,
  );
});
