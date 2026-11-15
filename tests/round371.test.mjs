import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project keeps Expand All in Options but removes the duplicate toolbar action', () => {
  assert.equal((source.match(/id: 'expandAll'/g) ?? []).length, 1);
  assert.match(
    source,
    /\{ id: 'expandAll', label: t\('editor\.expandAll'\), disabled: !projectExpandAllAvailable, restoreFocus: false,/,
  );
  assert.doesNotMatch(source, /icon: 'expand', label: t\('editor\.expandAll'\)/);
});

test('Project toolbar still keeps Expand Selected and Collapse All', () => {
  assert.match(source, /id: 'expandSelected',\s+group: 'navigation',\s+icon: 'expand',\s+label: t\('editor\.revealSelected'\)/);
  assert.match(source, /id: 'collapse', group: 'navigation', icon: 'collapse', label: t\('editor\.collapseAll'\), disabled: !canCollapseAll/);
  assert.match(source, /canCollapseAll: projectCanCollapseAll\(expanded\)/);
});

test('Project Options resolves Expand All from the EditorWorkspace state', () => {
  assert.match(
    source,
    /const projectExpandAllAvailable = projectTreeActionsAvailable\s+&& projectCanExpandAll\(entries, children, expanded\);/,
  );
  assert.match(
    source,
    /id: 'expandAll', label: t\('editor\.expandAll'\), disabled: !projectExpandAllAvailable, restoreFocus: false,/,
  );
  assert.doesNotMatch(source, /id: 'expandAll', label: t\('editor\.expandAll'\), disabled: !canExpandAll, restoreFocus: false,/);
});
