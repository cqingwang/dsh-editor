import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('Diff keeps IDEA mode controls fixed and restores edit actions before Open Local Version', () => {
  const start = source.indexOf('const diffToolbarActions =');
  const end = source.indexOf('const hidden =', start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  const applyLeftSide = block.indexOf("id: 'applyLeftSide'");
  const swapSides = block.indexOf("id: 'swapSides'");
  const settings = block.indexOf("id: 'settings'");
  const openLocalVersion = block.indexOf("id: 'openLocalVersion'");

  assert.doesNotMatch(block, /id: 'view'/);
  assert.ok(applyLeftSide >= 0 && swapSides > applyLeftSide);
  assert.ok(settings > swapSides);
  assert.ok(openLocalVersion > settings);
  assert.match(source, /React\.createElement\(DiffViewModeControl, \{/);
});

test('The first recovered Diff action slot is Apply Left Side once mode controls are fixed', () => {
  const directCountForWidth = new Function(
    `${extract('groupDiffToolbarActions')}\n${extract('diffDirectActionCountForWidth')}\nreturn diffDirectActionCountForWidth;`,
  )();
  const actions = ['applyLeftSide', 'swapSides', 'settings', 'undo', 'redoSides', 'openLocalVersion']
    .map((id) => ({ id, group: id === 'openLocalVersion' ? 'open' : id === 'settings' ? 'inspect' : 'mode' }));
  const count = directCountForWidth(320, 220, actions);
  assert.deepEqual(actions.slice(0, count).map((action) => action.id), ['applyLeftSide']);
});
