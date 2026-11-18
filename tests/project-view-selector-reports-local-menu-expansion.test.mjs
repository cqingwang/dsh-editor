import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist`);
  return source.slice(start, end);
}

test('the Project view selector reports its local menu expansion', () => {
  const panel = block('function ProjectPanel({', '/**\n     * IDEA-style context menu');
  assert.match(panel, /aria-label=\{`\$\{t\('editor\.projectViewMenu'\)\}: \$\{currentViewLabel\}`\}[\s\S]*?aria-haspopup='menu'[\s\S]*?aria-expanded=\{viewMenu !== null\}/s);
});

test('PanelToolbar can describe a popup badge without affecting plain badges', () => {
  assert.match(panelToolbarSource, /badgeHasPopup = undefined/);
  assert.match(panelToolbarSource, /badgeExpanded = undefined/);
  assert.match(panelToolbarSource, /aria-haspopup=\{badgeHasPopup\}/);
  assert.match(panelToolbarSource, /aria-expanded=\{badgeHasPopup === undefined \? undefined : badgeExpanded === true\}/);
});

test('the Commit branch chip stays expanded until its menu closes', () => {
  const panel = block('function CommitPanel({', '      const [historyMenu, setHistoryMenu]');
  assert.match(panel, /branchMenuOpen,/);
  const toolbar = block('titleAction: commitModeTabs,', 'historyMenu === null');
  assert.match(toolbar, /onBadge: onBranchMenu,[\s\S]*?badgeHasPopup: 'menu',[\s\S]*?badgeExpanded: branchMenuOpen === true/);
  assert.match(source, /owner: 'branch-menu'/);
  assert.match(source, /branchMenuOpen: menu\?\.owner === 'branch-menu'/);
});
