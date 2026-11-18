import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const optionsSource = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const source = [projectPanelSource, workspaceSource, optionsSource].join('\n');
const projectCanExpandAll = loadTypeScriptFunction(terminalSource, 'projectCanExpandAll');
const projectCanCollapseAll = loadTypeScriptFunction(terminalSource, 'projectCanCollapseAll');

test('Expand All is disabled only when every known directory is already expanded', () => {
  const entries = [
    { path: 'src', kind: 'directory' },
    { path: 'README.md', kind: 'file' },
  ];
  const children = {
    src: [{ path: 'src/nested', kind: 'directory' }],
    'src/nested': [],
  };
  assert.equal(projectCanExpandAll(entries, children, new Set([''])), true);
  assert.equal(projectCanExpandAll(entries, children, new Set(['src'])), true);
  assert.equal(projectCanExpandAll(entries, children, new Set(['src', 'src/nested'])), false);
  assert.equal(projectCanExpandAll([{ path: 'README.md', kind: 'file' }], {}, new Set([''])), false);
});

test('Collapse All is disabled when the tree has no expanded directory', () => {
  assert.equal(projectCanCollapseAll(new Set()), false);
  assert.equal(projectCanCollapseAll(new Set([''])), true);
  assert.equal(projectCanCollapseAll(new Set(['src'])), true);
});

test('Project keeps IDEA expander states without duplicating Expand All in the toolbar', () => {
  assert.doesNotMatch(source, /id: 'expandAll', icon: 'expand', label: t\('editor\.expandAll'\)/);
  assert.match(
    source,
    /id: 'collapse',\s+group: 'navigation',\s+icon: 'collapse',\s+label: t\('editor\.collapseAll'\),\s+disabled: !canCollapseAll/s,
  );
  assert.match(optionsSource, /id: 'expandAll',\s+label: t\('editor\.expandAll'\),\s+disabled: !expandAllAvailable,/);
  assert.match(workspaceSource, /const projectExpandAllAvailable = projectTreeActionsAvailable && projectCanExpandAll\(entries, children, expanded\)/);
  assert.match(workspaceSource, /canCollapseAll=\{projectCanCollapseAll\(expanded\)\}/);
});
