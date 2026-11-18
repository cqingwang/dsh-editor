import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const menuSource = readFileSync(join(root, 'src/client/components/commit/commit-options-menu.ts'), 'utf8');
const source = [
  readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8'),
  menuSource,
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8'),
].join('\n');

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  assert.notEqual(start, -1);
  const end = source.indexOf('function CommitLogView(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('both dictionaries name IDEA Changes View Options', () => {
  const occurrences = source.match(/^    viewOptions:/gmu) ?? [];
  assert.equal(occurrences.length, 2);
  assert.match(source, /viewOptions: '视图选项',/);
  assert.match(source, /viewOptions: 'View Options',/);
});

test('Changes action bar exposes View Options next to inspection actions', () => {
  const panel = commitPanel();
  const showDiff = panel.indexOf("id: 'showDiff'");
  const viewOptions = panel.indexOf("id: 'viewOptions'");
  const selectOpened = panel.indexOf("id: 'selectOpened'");
  assert.ok(showDiff >= 0 && viewOptions > showDiff && selectOpened > viewOptions);
  assert.match(panel, /id: 'viewOptions'[\s\S]*?group: 'view'[\s\S]*?icon: 'settings'[\s\S]*?label: t\('editor\.viewOptions'\)/);
  assert.match(panel, /onViewOptionsMenu\?\.\(/);
});

test('View Options reuses the existing Group by menu instead of a second value set', () => {
  const panel = commitPanel();
  assert.match(panel, /onViewOptionsMenu,/);
  assert.match(source, /onViewOptionsMenu=\{\(position\) => openChangesViewMenu\(position\)\}/);
  const handler = menuSource.slice(
    menuSource.indexOf('export function changesViewOptionsMenu('),
    menuSource.indexOf('export function commitOptionsMenu('),
  );
  assert.match(handler, /title: t\('editor\.viewOptions'\)/);
  assert.match(handler, /id: 'groupBy'/);
  assert.match(handler, /items: groupMenu\.items/);
  assert.match(handler, /changeGroupMenu\(\{[\s\S]*?position,/);
});
