import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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
  assert.match(panelToolbarSource, /const next = panelToolbarFit\(/);
  assert.match(panelToolbarSource, /titleRef\.current\?\.offsetWidth/);
  assert.match(panelToolbarSource, /badgeRef\.current\?\.offsetWidth/);
  assert.match(panelToolbarSource, /setFits\(\(current\) =>/);
  assert.match(panelToolbarSource, /maxWidth: '45%'/);
  assert.match(panelToolbarSource, /titleActionStyle/);
  assert.match(panelToolbarSource, /titleFlexible \? 0 : \(titleRef\.current\?\.offsetWidth \?\? 0\)/);
  assert.match(panelToolbarSource, /flex: '1 1 0%'/);
  assert.match(panelToolbarSource, /marginRight: 0/);
  assert.match(panelToolbarSource, /flex: '0 0 auto'/);
});

test('Project toolbar keeps Hide trailing and delegates flattened actions to More', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  const directRight = panel.slice(panel.indexOf('right={['), panel.indexOf('trailingRight={'));
  const directTrailing = panel.slice(panel.indexOf('trailingRight={'), panel.indexOf('overflowMenuItems={'));
  assert.doesNotMatch(directRight, /id: 'options'/);
  assert.doesNotMatch(directRight, /id: 'hide'/);
  assert.match(directTrailing, /id: 'hide'/);
  assert.doesNotMatch(panel, /overflowMenuItems=/u);
  assert.match(panel, /openProjectViewMenu\(event\.currentTarget, true\)/u);
});
