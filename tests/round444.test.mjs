import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

test('direct Diff submenu actions expose menu semantics without lying about expanded state', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /openDiffActionSubmenu = React\.useCallback\(\(event, title, items, actionId = null\)/);
  assert.match(diff, /actionId,\s+items,/);
  assert.match(diff, /openDiffActionSubmenu\(event, t\('editor\.settings'\), editorSettingsItems, 'settings'\)/);
  assert.match(diff, /ariaHasPopup: Array\.isArray\(action\.items\) \? 'menu' : undefined/);
  assert.match(diff, /ariaExpanded: Array\.isArray\(action\.items\) \? diffActionMenu\?\.actionId === action\.id : undefined/);
});

test('medium Diff widths recover Apply, Swap and Reload after the fixed mode control', () => {
  const directCountForWidth = new Function(
    `${extract('groupDiffToolbarActions')}\n${extract('diffDirectActionCountForWidth')}\nreturn diffDirectActionCountForWidth;`,
  )();
  const actions = [
    ['applyLeftSide', 'mode'],
    ['swapSides', 'mode'],
    ['disableEditing', 'mode'],
    ['focusOppositePane', 'selection'],
    ['selectPositionInOppositePane', 'selection'],
    ['reloadDiff', 'inspect'],
    ['find', 'inspect'],
    ['collapse', 'inspect'],
    ['settings', 'inspect'],
    ['openLocalVersion', 'open'],
    ['undo', 'history'],
    ['redo', 'history'],
  ].map(([id, group]) => ({ id, group }));
  const visible = (width) => actions.slice(0, directCountForWidth(width, 220, actions)).map((action) => action.id);

  assert.deepEqual(visible(320), ['applyLeftSide']);
  assert.deepEqual(visible(360), ['applyLeftSide', 'swapSides']);
  assert.deepEqual(visible(400), ['applyLeftSide', 'swapSides', 'disableEditing', 'focusOppositePane']);
  assert.ok(visible(520).includes('reloadDiff'));
  assert.ok(visible(520).includes('find'));
  assert.ok(!visible(520).includes('openLocalVersion'));
});
