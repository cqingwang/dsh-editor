import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/terminal.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
].join('\n');

test('the change-tree fold state survives a reload, per workspace', () => {
  /* IDEA remembers which change groups you collapsed; losing that on every refresh
     means re-collapsing the same three groups all day. The key carries the root
     because two workspaces do not share a changelist shape. */
  assert.match(source, /dsh-editor\.collapsedGroups:\$\{/);
  assert.match(source, /function readCollapsedGroups\(root\)/);
  assert.match(source, /function writeCollapsedGroups\(root, collapsed\)/);
  const start = source.indexOf('const toggleCollapsedGroup = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 900);
  assert.match(block, /writeCollapsedGroups\(/);
});

test('a malformed stored value degrades to "nothing collapsed"', () => {
  const start = source.indexOf('function readCollapsedGroups(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 700);
  assert.match(block, /JSON\.parse/);
  assert.match(block, /Array\.isArray/);
  /* Storage can be disabled entirely; the tree still has to render. */
  assert.match(block, /catch/);
});

test('the fold state is restored once the workspace root is known', () => {
  /* The key includes the root, so it cannot be read during the first render. */
  assert.match(source, /const \[\s*collapsedGroups,\s*setCollapsedGroups,\s*\] = React\.useState\(\(\) => new Set\(\)\);/);
  assert.match(source, /if \(\s+collapsedRestoredFor\.current !== \(value\.root \?\? ''\)\s+\) \{/);
  assert.match(source, /setCollapsedGroups\(readCollapsedGroups\(value\.root \?\? ''\)\);/);
});
