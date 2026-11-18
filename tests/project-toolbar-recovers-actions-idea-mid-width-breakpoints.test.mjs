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
  assert.deepEqual(fit(220, 94.5, 2, 4, 0), { left: 0, right: 3 });
  assert.deepEqual(fit(260, 108.8, 2, 4, 0), { left: 0, right: 4 });
  assert.deepEqual(fit(300, 108.8, 2, 4, 0), { left: 2, right: 4 });
});

test('Project toolbar declares IDEA create, navigation and window groups', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  const toolbar = panel.slice(panel.indexOf('left={['), panel.indexOf('dropActive={toolbarDropActive}'));
  assert.match(toolbar, /id: 'newEntry'[\s\S]*?group: 'create'/);
  assert.match(toolbar, /id: 'reveal'[\s\S]*?group: 'navigation'/);
  assert.match(toolbar, /id: 'expandSelected'[\s\S]*?group: 'navigation'/);
  assert.match(toolbar, /id: 'collapse'[\s\S]*?group: 'navigation'/);
  assert.match(toolbar, /id: 'options'[\s\S]*?group: 'window'/);
  assert.match(toolbar, /id: 'hide'[\s\S]*?group: 'window'/);
});

test('PanelToolbar preserves semantic groups in its overflow menu', () => {
  assert.match(panelToolbarSource, /items: groupCompactActions\(hidden\)\.map/);
  assert.match(panelToolbarSource, /id: action\.id,[\s\S]*?run: \(\) => action\.onClick\(\)/);
});

test('ContextMenu exposes null entries as menu separators', () => {
  const menu = source;
  assert.match(menu, /key=\{`sep-\$\{index\}`\}[\s\S]*?role='separator'/);
});
