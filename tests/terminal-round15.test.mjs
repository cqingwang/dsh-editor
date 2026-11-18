import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const iconSource = read('src/client/components/ui/Icon.tsx');

test('terminal tabs carry an explicit order the host persists', () => {
  const hub = read('lib/terminal.js');
  const host = read('lib/index.js');
  assert.match(hub, /this\.order = 0;/);
  assert.match(hub, /order: this\.order,/);
  assert.match(hub, /\.sort\(\(left, right\) => left\.order - right\.order\)/);
  assert.match(hub, /reorder\(sessionId, ids\)/);
  assert.match(hub, /terminal\.order = terminals\.size;/);
  assert.match(host, /case 'reorder':/);
});

test('terminal tabs are draggable and reorder told the host', () => {
  const client = `${read('tests/fixtures/terminal-panel.legacy.js')}\n${read('lib/client.js')}`;
  assert.match(client, /const \[dragId, setDragId\] = React\.useState/);
  assert.match(client, /draggable: true/);
  assert.match(client, /void moveTab\(source, terminal\.id\)/);
  assert.match(client, /const moveTab = React\.useCallback/);
  assert.match(client, /op: 'reorder', ids: next/);
  assert.match(client, /terminalTabDrop/);
});

test('a freshly created entry opens straight into inline rename', () => {
  const client = `${read('tests/fixtures/terminal-panel.legacy.js')}\n${read('lib/client.js')}`;
  /* Round 153 dropped `parent` from the rename state: `commitRename` derives the
     destination from the entry's own path, so no caller can supply one that makes
     the new name a child of the entry itself. */
  assert.match(client, /setRenameState\(\{ path, value: name, fresh: true \}\)/);
  assert.match(client, /const inlineEditing = activeNode\?\.closest\('\[data-dsh-editor-workspace\] input'\)/);
  /* Round 143: a plain tree click also keeps the caret in the tree, which is what
     makes the tree's advertised keys (F2, Delete, ⌘R, typeahead) reachable. */
  assert.match(client, /const inTree = activeNode\?\.closest\('\[role="tree"\]'\) != null;/);
  assert.match(client, /if \(!inlineEditing && !inTree && !inTabs\) editor\.focus\(\);/);
});

test('commit and push button is labelled and a rejected push stays visible', () => {
  const client = `${read('tests/fixtures/commit-panel.legacy.js')}\n${read('lib/client.js')}`;
  assert.match(iconSource, /case 'push':/);
  /* Round 140 replaced the icon-only second button with IDEA's labelled
     "Commit and Push…": an icon does not say what the irreversible remote action
     is, and the two buttons now read as a matched pair. */
  const body = client.slice(client.indexOf('onClick: () => onCommit(true)'), client.indexOf('onClick: () => onCommit(true)') + 700);
  assert.match(body, /\n\s+t\('editor\.commitAndPush'\),\n\s+\),/);
  /* The failure now has its own state so a retry button can appear. */
  assert.match(client, /setPushError\(value\.pushError \?\? null\);/);
  assert.match(client, /t\('editor\.pushedFailed', \{ message: pushFailure \}\)/);
});
