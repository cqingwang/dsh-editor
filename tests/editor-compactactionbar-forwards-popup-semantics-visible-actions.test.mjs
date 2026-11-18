import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactActionBarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist`);
  return source.slice(start, end);
}

function commitPanel() {
  return block('function CommitPanel({', 'export { CommitPanel };');
}

test('CompactActionBar forwards popup semantics from visible actions', () => {
  assert.match(compactActionBarSource, /ariaHasPopup=\{action\.ariaHasPopup\}/);
  assert.match(compactActionBarSource, /ariaExpanded=\{action\.ariaExpanded\}/);
});

test('Changes View Options exposes menu and live expanded state', () => {
  const panel = commitPanel();
  assert.match(panel, /viewOptionsOpen,/);
  assert.match(
    panel,
    /id: 'viewOptions',[\s\S]*?ariaHasPopup: 'menu',[\s\S]*?ariaExpanded: viewOptionsOpen === true/,
  );
  assert.match(source, /owner: 'changes-view-options'/);
  assert.match(source, /viewOptionsOpen: menu\?\.owner === 'changes-view-options'/);
});

test('group More actions reports the group menu it owns', () => {
  const panel = commitPanel();
  assert.match(
    panel,
    /label=\{t\('editor\.moreActionsFor', \{\s+group: group\.label,\s+\}\)\}[\s\S]*?ariaHasPopup='menu'[\s\S]*?ariaExpanded=\{groupActionMenu\?\.owner === `group-actions:\$\{group\.id\}`\}/u,
  );
  const ownerWrites = panel.match(/owner: `group-actions:\$\{group\.id\}`/g) ?? [];
  assert.equal(ownerWrites.length, 3);
});
