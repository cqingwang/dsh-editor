import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function projectPanel() {
  const start = source.indexOf('function ProjectPanel(');
  const end = source.indexOf('IDEA-style context menu', start);
  assert.notEqual(start, -1);
  return source.slice(start, end < 0 ? source.length : end);
}

test('The project title owns the removed root row context menu', () => {
  const panel = projectPanel();
  assert.match(panel, /onRootContextMenu,/);
  assert.match(panel, /rootContextMenuOpen,/);
  assert.match(panel, /className: 'dsh-editor-project-root-button'[\s\S]*?onContextMenu: \(event\) => \{/);
  assert.match(panel, /className: 'dsh-editor-project-root-button'[\s\S]*?event\.key !== 'ContextMenu'/);
  assert.match(panel, /rootContextMenuOpen \? \{ background: 'var\(--dsw-alias-state-business-primary\)', color: '#fff' \}/);
});

test('The tree background also opens the workspace root context menu', () => {
  const panel = projectPanel();
  assert.match(panel, /closest\('\.dsh-editor-tree-row'\) !== null/);
  assert.match(panel, /onRootContextMenu\(\{ x: event\.clientX, y: event\.clientY \}\)/);
});

test('The root context payload still enables New File and New Folder at the workspace root', () => {
  assert.match(
    source,
    /onRootContextMenu: \(\{ x, y \}\) => setMenu\(\{[\s\S]*?owner: 'project-root',[\s\S]*?\.\.\.buildTreeMenu\(\{[\s\S]*?path: '',[\s\S]*?kind: 'directory',[\s\S]*?root: true/,
  );
  assert.match(source, /rootContextMenuOpen: menu\?\.owner === 'project-root'/);
  assert.match(source, /const createParent = isDirectory \? row\.path : dirname\(row\.path\);/);
  assert.match(source, /run: \(\) => startCreate\('file', createParent\)/);
  assert.match(source, /run: \(\) => startCreate\('directory', createParent\)/);
});
