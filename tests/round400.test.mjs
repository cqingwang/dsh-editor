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

const toolPanelFlex = new Function(
  'const TOOL_PANEL_MIN_PX = 200;\n' + extract('toolPanelFlex') + '\nreturn toolPanelFlex;',
)();

test('both IDEA tool windows keep the supported 200px minimum', () => {
  assert.equal(toolPanelFlex('project', 5), '0 0 clamp(200px, 14%, 420px)');
  assert.equal(toolPanelFlex('commit', 5), '0 0 clamp(200px, 14%, 480px)');
  assert.equal(toolPanelFlex('project', 90), '0 0 clamp(200px, 72%, 420px)');
  assert.equal(toolPanelFlex('commit', 90), '0 0 clamp(200px, 72%, 480px)');
});

test('Commit keeps the IDEA trailing toolbar controls direct at minimum width', () => {
  const start = source.indexOf('React.createElement(PanelToolbar, {', source.indexOf('function CommitPanel('));
  const toolbar = source.slice(start, source.indexOf('historyMenu === null', start));
  assert.match(toolbar, /id: 'options'[\s\S]*?id: 'refresh'[\s\S]*?id: 'hide'/);
});

test('Changes keeps Refresh and View Options pinned before compact overflow', () => {
  const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));
  assert.match(commit, /id: 'refresh', group: 'refresh',[\s\S]*?pinned: true/);
  assert.match(commit, /id: 'viewOptions',[\s\S]*?pinned: true/);
  assert.match(commit, /<CommitPanel|React\.createElement\(CompactActionBar, \{/);
});
