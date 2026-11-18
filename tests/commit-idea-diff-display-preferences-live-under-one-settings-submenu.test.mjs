import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  const start = source.indexOf('function DiffPreview(');
  const end = source.indexOf('\n    function ', start + 10);
  assert.notEqual(start, -1, 'DiffPreview is missing');
  assert.notEqual(end, -1, 'DiffPreview end marker is missing');
  return source.slice(start, end);
}

test('IDEA diff display preferences live under one Settings submenu', () => {
  const diff = diffPreview();
  const settings = diff.slice(diff.indexOf('const editorSettingsItems ='), diff.indexOf('const diffToolbarActions ='));
  for (const id of ['whitespace', 'showWhitespaces', 'lineNumbers', 'indentGuides', 'softWrap']) {
    assert.match(settings, new RegExp(`id: '${id}'`), `${id} must be inside Settings`);
  }
  assert.match(
    diff,
    /id: 'settings',\s+icon: 'settings',\s+label: t\('editor\.settings'\),\s+group: 'inspect',\s+disabled: diffUnavailable,\s+items: editorSettingsItems,/,
  );
  assert.match(diff, /items: action\.items,/);
  assert.doesNotMatch(settings, /restoreFocus: false/);
});

test('Settings opens as a submenu and remains one action in the narrow toolbar', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /run:\s*\(event(?::\s*[^)]+)?\)\s*=>\s*openDiffActionSubmenu\(\s*event,\s*t\('editor\.settings'\),\s*editorSettingsItems,\s*'settings',?\s*\)/,
  );
  assert.match(diff, /const openDiffActionSubmenu = React\.useCallback\(/);
  assert.match(diff, /setDiffActionMenu\(\{[\s\S]*?title,[\s\S]*?actionId,[\s\S]*?items,[\s\S]*?\}\)/);
});

test('the opposite-pane action now uses IDEA wording', () => {
  assert.ok(source.includes("diffFocusOppositePane: '选择对侧差异面板'"));
  assert.ok(source.includes("diffFocusOppositePane: 'Select Opposite Diff Pane'"));
});
