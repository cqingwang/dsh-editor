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
const projectCanCollapseAll = loadTypeScriptFunction(terminalSource, 'projectCanCollapseAll');

test('Collapse All is disabled when the tree has no expanded directory', () => {
  assert.equal(projectCanCollapseAll(new Set()), false);
  assert.equal(projectCanCollapseAll(new Set([''])), true);
  assert.equal(projectCanCollapseAll(new Set(['src'])), true);
});

test('Project keeps Collapse All without any toolbar expand action', () => {
  assert.doesNotMatch(source, /id: 'expandAll'|id: 'expandSelected'|editor\.revealSelected/);
  assert.match(
    source,
    /id: 'collapse',\s+group: 'navigation',\s+icon: 'collapse',\s+label: t\('editor\.collapseAll'\),\s+disabled: !canCollapseAll/s,
  );
  assert.doesNotMatch(optionsSource, /id: 'expandAll'|expandAllAvailable|onExpandAll/);
  assert.doesNotMatch(
    workspaceSource,
    /projectExpandAllAvailable|const expandAll =|onExpandAll|onExpandSelected|expandSelectedTree|projectCanExpandSelection/,
  );
  assert.match(workspaceSource, /canCollapseAll=\{projectCanCollapseAll\(expanded\)\}/);
});
