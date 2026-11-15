import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function projectOptions() {
  const start = source.indexOf("title: t('editor.options'),");
  assert.notEqual(start, -1);
  const end = source.indexOf('onCreateChange:', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Project Options uses IDEA Behavior and Appearance submenus', () => {
  const options = projectOptions();
  assert.match(options, /id: 'behavior'/);
  assert.match(options, /label: t\('editor\.projectOptionsBehavior'\)/);
  assert.match(options, /id: 'appearance'/);
  assert.match(options, /label: t\('editor\.projectOptionsAppearance'\)/);
});

test('single-click and autoscroll preferences live under Behavior', () => {
  const options = projectOptions();
  const start = options.indexOf("id: 'behavior'");
  const end = options.indexOf("id: 'appearance'", start);
  const behavior = options.slice(start, end);
  for (const id of ['autoscroll', 'singleClickOpen', 'openDirectoriesSingleClick']) {
    assert.match(behavior, new RegExp(`id: '${id}'`));
  }
});

test('sort and hidden-file preferences live under Appearance', () => {
  const options = projectOptions();
  const start = options.indexOf("id: 'appearance'");
  const appearance = options.slice(start);
  assert.match(appearance, /id: `sort:\$\{mode\}`/);
  assert.match(appearance, /\['name', 'type', 'modified', 'modified-asc'\]\.map/);
  assert.match(appearance, /const labelMode = mode === 'modified-asc' \? 'modified_asc' : mode;/);
  assert.match(appearance, /t\(`editor\.sort_\$\{labelMode\}`\)/);
  assert.match(appearance, /id: 'hidden'/);
});

test('high-frequency navigation actions stay at the top level', () => {
  const options = projectOptions();
  for (const id of ['refresh', 'gotoFile', 'recent', 'expandAll']) {
    assert.match(options, new RegExp(`id: '${id}'`));
  }
});

test('submenu Left and Escape return focus without depending on animation frames', () => {
  const start = source.indexOf('function ContextMenu(');
  const menu = source.slice(start, source.indexOf('/**\n     * A tool-window splitter', start));
  const returns = menu.match(/window\.setTimeout\(\(\) => itemButton\(parentId\)\?\.focus\(\), 0\)/g) ?? [];
  assert.ok(returns.length >= 2, 'both ArrowLeft and Escape must restore the parent row');
  assert.doesNotMatch(menu, /requestAnimationFrame\(\(\) => itemButton\(parentId\)\?\.focus\(\)\)/);
});
