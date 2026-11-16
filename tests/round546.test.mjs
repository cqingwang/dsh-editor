import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const groupStart = source.indexOf('function createCodeEditorGroup(');
const groupEnd = source.indexOf('\n    /**\n     * Reuse one workspace model', groupStart);
const group = source.slice(groupStart, groupEnd);

test('Monaco context menu exposes Search Web through the symbol precondition', () => {
  const action = group.slice(
    group.indexOf('id: `dsh-editor.searchWeb.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.match(action, /label: actionsHandlers\.searchWebLabel \?\? 'Search with Google'/);
  assert.match(action, /precondition: findUsagesPrecondition/);
  assert.match(action, /contextMenuGroupId: 'navigation'/);
  assert.match(action, /contextMenuOrder: 1\.5/);
});

test('context Search Web reuses symbol resolution and safe URL semantics', () => {
  const action = group.slice(
    group.indexOf('id: `dsh-editor.searchWeb.${groupId}`'),
    group.indexOf("id: 'dsh-editor.closeTab'"),
  );
  assert.match(action, /const query = findUsagesSearchTarget\(editor\)\.query/);
  assert.match(action, /https:\/\/www\.google\.com\/search\?q=\$\{encodeURIComponent\(query\)\}/);
  assert.match(action, /'_blank',\n\s+'noopener,noreferrer'/);
});

test('both editor groups localize the Search Web menu label', () => {
  assert.equal((source.match(/searchWebLabel: t\('editor\.searchWebAction'\)/g) ?? []).length, 2);
});
