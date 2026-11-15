import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('only a wide host sidebar is collapsed before entering the workspace Editor', () => {
  const marker = 'function sidebarNeedsCollapse(';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'sidebarNeedsCollapse should exist');
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const fnSource = source.slice(start, index + 1);
  const sidebarNeedsCollapse = new Function(`${fnSource}; return sidebarNeedsCollapse;`)();

  assert.equal(sidebarNeedsCollapse(280), true);
  assert.equal(sidebarNeedsCollapse(160), true);
  assert.equal(sidebarNeedsCollapse(96), false);
  assert.equal(sidebarNeedsCollapse(52), false);
  assert.equal(sidebarNeedsCollapse(0), false);
  assert.equal(sidebarNeedsCollapse(Number.NaN), false);
});

test('the workspace menu Editor action collapses the conversation sidebar before opening', () => {
  const start = source.indexOf('function ensureWorkspaceEditorItem(');
  const end = source.indexOf('/* A click on any real View tab', start);
  assert.ok(start >= 0 && end > start, 'workspace Editor injection should exist');
  const block = source.slice(start, end);
  assert.match(block, /collapseConversationSidebar\(\)/);
  assert.match(block, /openEditorSplit\(workspaceId\)/);
  assert.ok(
    block.indexOf('collapseConversationSidebar()') < block.indexOf('openEditorSplit(workspaceId)'),
    'the sidebar should already be collapsing as the Editor opens',
  );
});

test('sidebar collapse targets the host toggle and measures the real sidebar column', () => {
  const start = source.indexOf('function collapseConversationSidebar(');
  assert.ok(start >= 0, 'collapseConversationSidebar should exist');
  const block = source.slice(start, start + 1200);
  assert.match(block, /querySelector\('\[data-sidebar-toggle\]'\)/);
  assert.match(block, /closest\('\[data-slot="sidebar"\]'\)/);
  assert.match(block, /sidebarColumn\?\.getBoundingClientRect\(\)\.width/);
  assert.match(block, /sidebarNeedsCollapse\(/);
  assert.match(block, /toggle\.click\(\)/);
});
