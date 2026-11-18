import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  assert.notEqual(start, -1);
  const end = source.indexOf('function CommitLogView(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('both dictionaries name IDEA Changes View Options', () => {
  const occurrences = source.match(/^        viewOptions:/gmu) ?? [];
  assert.equal(occurrences.length, 2);
  assert.match(source, /viewOptions: '视图选项',/);
  assert.match(source, /viewOptions: 'View Options',/);
});

test('Changes action bar exposes View Options next to inspection actions', () => {
  const panel = commitPanel();
  const actions = panel.slice(panel.indexOf('actions: ['), panel.indexOf('},\n            }),', panel.indexOf('id: \'rollback\'')));
  const showDiff = actions.indexOf("id: 'showDiff'");
  const viewOptions = actions.indexOf("id: 'viewOptions'");
  const selectOpened = actions.indexOf("id: 'selectOpened'");
  assert.ok(showDiff >= 0 && viewOptions > showDiff && selectOpened > viewOptions);
  assert.match(actions, /id: 'viewOptions',\s+group: 'view',\s+icon: 'settings',\s+label: t\('editor\.viewOptions'\)/);
  assert.match(actions, /onViewOptionsMenu\?\.\(/);
});

test('View Options reuses the existing Group by menu instead of a second value set', () => {
  const panel = commitPanel();
  assert.match(panel, /onViewOptionsMenu,/);
  assert.match(source, /onViewOptionsMenu: \(position\) => openChangesViewMenu\(position\)/);
  const handler = source.slice(
    source.indexOf('const openChangesViewMenu = React.useCallback('),
    source.indexOf("/* IDEA's \"Move to…\" picker", source.indexOf('const openChangesViewMenu = React.useCallback(')),
  );
  assert.notEqual(handler.length, 0);
  assert.match(handler, /title: t\('editor\.viewOptions'\)/);
  assert.match(handler, /id: 'groupBy'/);
  assert.match(handler, /items: groupMenu\.items/);
  assert.match(handler, /changeGroupMenu\(position\)/);
});
