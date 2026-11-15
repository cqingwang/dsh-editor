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

test('Diff restores high-frequency mode controls before Open Local Version', () => {
  const start = source.indexOf('const diffToolbarActions =');
  const end = source.indexOf('const hidden =', start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  const view = block.indexOf("id: 'view'");
  const applyLeftSide = block.indexOf("id: 'applyLeftSide'");
  const swapSides = block.indexOf("id: 'swapSides'");
  const settings = block.indexOf("id: 'settings'");
  const openLocalVersion = block.indexOf("id: 'openLocalVersion'");

  assert.ok(view >= 0 && applyLeftSide > view && swapSides > applyLeftSide);
  assert.ok(settings > swapSides);
  assert.ok(openLocalVersion > settings);
});

test('The first recovered Diff action slot is the view toggle', () => {
  const directCountForWidth = new Function(
    `${extract('groupDiffToolbarActions')}\n${extract('diffDirectActionCountForWidth')}\nreturn diffDirectActionCountForWidth;`,
  )();
  const actions = ['view', 'applyLeftSide', 'swapSides', 'settings', 'undo', 'redoSides', 'openLocalVersion']
    .map((id) => ({ id, group: id === 'openLocalVersion' ? 'open' : id === 'settings' ? 'inspect' : 'mode' }));
  const count = directCountForWidth(320, 220, actions);
  assert.deepEqual(actions.slice(0, count).map((action) => action.id), ['view']);
});
