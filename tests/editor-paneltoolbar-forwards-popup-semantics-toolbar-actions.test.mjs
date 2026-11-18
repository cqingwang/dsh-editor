import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('./fixtures/commit-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('./fixtures/project-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist`);
  return source.slice(start, end);
}

test('PanelToolbar forwards popup semantics from toolbar actions', () => {
  assert.match(panelToolbarSource, /ariaHasPopup=\{action\.ariaHasPopup\}/);
  assert.match(panelToolbarSource, /ariaExpanded=\{action\.ariaExpanded\}/);
});

test('Project Options exposes menu and live expanded state', () => {
  const panel = block('function ProjectPanel({', '/**\n     * IDEA-style context menu');
  assert.match(panel, /optionsOpen,/);
  assert.match(
    panel,
    /id: 'options',[\s\S]*?ariaHasPopup: 'menu',[\s\S]*?ariaExpanded: optionsOpen/,
  );
  assert.match(source, /owner: 'project-options'/);
  assert.match(source, /optionsOpen: menu\?\.owner === 'project-options'/);
});

test('Commit Options exposes menu and live expanded state', () => {
  const panel = block('function CommitPanel({', '      const [historyMenu, setHistoryMenu]');
  assert.match(panel, /optionsOpen,/);
  const toolbar = block('titleAction: commitModeTabs,', 'historyMenu === null');
  assert.match(
    toolbar,
    /id: 'options',[\s\S]*?ariaHasPopup: 'menu',[\s\S]*?ariaExpanded: optionsOpen/,
  );
  assert.match(source, /owner: 'commit-options'/);
  assert.match(source, /optionsOpen: menu\?\.owner === 'commit-options'/);
});
