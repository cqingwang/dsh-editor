import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
);

test('Persistent Find exposes IDEA Settings directly in the dock toolbar', () => {
  assert.match(findTool, /onOpenSettings/);
  assert.match(findTool, /icon: 'settings'/);
  assert.match(findTool, /label: t\('editor\.findSettings'\)/);
  assert.match(findTool, /onClick: onOpenSettings/);
  assert.doesNotMatch(findTool, /floating \? \[\] : \[\{[\s\S]*?id: 'settings'[\s\S]*?\}\]\}\)/);
  assert.match(source, /findSettings: '设置…'/);
  assert.match(source, /findSettings: 'Settings…'/);
});

test('Settings action keeps IDEA toolbar order between navigation and Group By', () => {
  const rerun = findTool.indexOf("id: 'rerun'");
  const previous = findTool.indexOf("id: 'previous'");
  const next = findTool.indexOf("id: 'next'");
  const settings = findTool.indexOf("id: 'settings'");
  const groupBy = findTool.indexOf("id: 'groupBy'");
  assert.ok(rerun >= 0);
  assert.ok(previous > rerun);
  assert.ok(next > previous);
  assert.ok(settings > next);
  assert.ok(groupBy > settings);
});

test('Settings returns the same Find state to the configured popup surface', () => {
  assert.match(source, /const openFindToolSettings = React\.useCallback/);
  assert.match(source, /surface: 'popup'/);
  assert.match(source, /mode: current\.mode/);
  assert.match(source, /onOpenSettings: openFindToolSettings/);
  assert.match(source, /\[data-dsh-find-tool-window\] input\[role="combobox"\]/);
});
