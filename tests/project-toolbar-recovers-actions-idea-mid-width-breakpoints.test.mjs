import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

const fit = new Function(`${extract('panelToolbarFit')}\nreturn panelToolbarFit;`)();

test('Project toolbar recovers actions at IDEA mid-width breakpoints', () => {
  assert.deepEqual(fit(200, 76, 0, 3, 0, 0, 22, 1), { left: 0, right: 3 });
  assert.deepEqual(fit(170, 76, 0, 3, 0, 0, 22, 1), { left: 0, right: 2 });
  assert.deepEqual(fit(130, 76, 0, 3, 0, 0, 22, 1), { left: 0, right: 0 });
});

test('Project toolbar keeps navigation and window groups while flattened actions live in More', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  const toolbar = panel.slice(panel.indexOf('right={['), panel.indexOf('dropActive={toolbarDropActive}'));
  assert.match(toolbar, /id: 'reveal'[\s\S]*?group: 'navigation'/);
  assert.match(toolbar, /id: 'collapse'[\s\S]*?group: 'navigation'/);
  assert.doesNotMatch(toolbar, /id: 'expandSelected'/);
  assert.match(toolbar, /id: 'hide'[\s\S]*?group: 'window'/);
  assert.match(toolbar, /trailingRight=\{\[[\s\S]*?id: 'hide'[\s\S]*?\]\}/);
  assert.doesNotMatch(toolbar, /id: 'newEntry'|id: 'options'/);
  assert.doesNotMatch(toolbar, /overflowMenuItems=/);
});

test('PanelToolbar preserves semantic groups in its overflow menu', () => {
  assert.match(panelToolbarSource, /items: overflowMenuEntries/);
  assert.match(panelToolbarSource, /id: action\.id,[\s\S]*?run: \(\) => action\.onClick\?\.\(\)/);
});

test('ContextMenu exposes null entries as menu separators', () => {
  const menu = source;
  assert.match(menu, /key=\{`sep-\$\{index\}`\}[\s\S]*?role='separator'/);
});
