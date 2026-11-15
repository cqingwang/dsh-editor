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

const fit = new Function(`${extract('panelToolbarFit')}\nreturn panelToolbarFit;`)();

test('panel toolbar reserves the trailing IDEA actions before middle actions', () => {
  assert.deepEqual(fit(200, 90, 4, 2, 0), { left: 0, right: 2 });
  assert.deepEqual(fit(400, 100, 4, 2, 0), { left: 4, right: 2 });
  assert.deepEqual(fit(170, 90, 4, 2, 0), { left: 0, right: 1 });
});

test('PanelToolbar uses the pure fit result and a bounded Project view title', () => {
  const toolbar = source.slice(source.indexOf('function PanelToolbar('), source.indexOf('/** One 24px panel toolbar button. */'));
  assert.match(toolbar, /const next = panelToolbarFit\(\s*node\.clientWidth,\s*titleRef\.current\?\.offsetWidth \?\? 0,\s*left\.length,\s*right\.length,\s*badgeRef\.current\?\.offsetWidth \?\? 0,\s*\)/s);
  assert.match(toolbar, /setFits\(\(current\) =>/);
  assert.match(source, /style: titleAction === null\s*\? styles\.panelTitle\s*:\s*\{ \.\.\.styles\.panelTitle, maxWidth: '45%', \.\.\.\(titleActionStyle \?\? null\) \}/s);
});

test('Project direct toolbar keeps Options and Hide at 200px', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  const toolbar = panel.slice(panel.indexOf('title: t(\'editor.project\')'), panel.indexOf('searchOpen\n'));
  assert.match(toolbar, /id: 'options'[\s\S]*?id: 'hide'/);
});
