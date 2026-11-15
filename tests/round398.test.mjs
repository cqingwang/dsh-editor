import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Diff Settings toggles expose boolean active state for checkbox semantics', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  const settings = diff.slice(diff.indexOf('const editorSettingsItems ='), diff.indexOf('const diffToolbarActions ='));
  for (const [id, state] of [
    ['whitespace', 'ignoreWhitespace'],
    ['showWhitespaces', 'showWhitespaces'],
    ['lineNumbers', 'showLineNumbers'],
    ['indentGuides', 'showIndentGuides'],
    ['softWrap', 'softWrap'],
  ]) {
    const start = settings.indexOf(`id: '${id}'`);
    assert.notEqual(start, -1, `${id} must exist`);
    const block = settings.slice(start, settings.indexOf('},', start));
    assert.match(block, new RegExp(`active: ${state},`), `${id} must expose ${state}`);
  }
});

test('ContextMenu submenu parents expose popup and expanded state', () => {
  const menu = source.slice(
    source.indexOf('function ContextMenu({ menu, onClose, t })'),
    source.indexOf('function groupDiffToolbarActions('),
  );
  assert.match(menu, /'aria-haspopup': Array\.isArray\(item\.items\) && item\.items\.length > 0 \? 'menu' : undefined/);
  assert.match(menu, /'aria-expanded': Array\.isArray\(item\.items\) && item\.items\.length > 0 \? submenu === item\.id : undefined/);
  assert.match(menu, /'aria-haspopup': Array\.isArray\(child\.items\) && child\.items\.length > 0 \? 'menu' : undefined/);
  assert.match(menu, /'aria-expanded': Array\.isArray\(child\.items\) && child\.items\.length > 0 \? submenu === child\.id : undefined/);
});

test('Settings remains a single nested parent in the overflow menu', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /id: 'settings',[\s\S]*?items: editorSettingsItems,/);
  assert.match(diff, /items: hiddenDiffActionEntries\.map/);
});
