import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8');

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

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  const end = source.indexOf('export { CommitPanel };', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Commit mode tabs replace the fixed title in the tool-window toolbar', () => {
  const panel = commitPanel();
  const toolbarStart = panel.indexOf('<PanelToolbar');
  const toolbarEnd = panel.indexOf('historyMenu === null', toolbarStart);
  assert.notEqual(toolbarStart, -1);
  assert.notEqual(toolbarEnd, -1);
  const toolbar = panel.slice(toolbarStart, toolbarEnd);

  assert.match(toolbar, /ariaLabel=\{t\('editor\.commit'\)\}/);
  assert.doesNotMatch(toolbar, /icon: 'commit'/);
  assert.doesNotMatch(toolbar, /title: t\('editor\.commit'\)/);
  assert.match(toolbar, /titleAction=\{commitModeTabs\}/);
  assert.match(toolbar, /titleActionStyle=\{styles\.commitToolbarTitleAction\}/);
});

test('Change and Commit tabs retain their existing mode, count and selection semantics', () => {
  const panel = commitPanel();

  assert.match(panel, /style=\{styles\.commitToolbarTabs\}\s+role='tablist'/u);
  assert.match(panel, /aria-selected=\{mode === 'changes'\}/);
  assert.match(panel, /onClick=\{\(event\) => \{\s+event\.currentTarget\.focus\?\.\(\);\s+onMode\('changes'\);\s+\}\}/u);
  assert.match(panel, /t\('editor\.tabChanges'\)\}\s+<span style=\{styles\.commitGroupCount\}>\{String\(changes\.length\)\}<\/span>/u);
  assert.match(panel, /aria-selected=\{mode === 'log'\}/);
  assert.match(panel, /onClick=\{\(event\) => \{\s+event\.currentTarget\.focus\?\.\(\);\s+onMode\('log'\);\s+\}\}/u);
  assert.match(panel, /t\('editor\.tabLog'\)\}/);
});

test('the old standalone tab row is removed', () => {
  const panel = commitPanel();

  assert.doesNotMatch(panel, /style: styles\.commitTabs/);
  assert.doesNotMatch(panel, /styles\.commitTabs/);
});

test('the moved tabs use the user-requested Change and Commit labels', () => {
  assert.equal(locales.match(/tabChanges: 'Changes'/g)?.length, 2);
  assert.equal(locales.match(/tabLog: 'Commit'/g)?.length, 2);
});

test('PanelToolbar accepts a scoped title-action style without changing other callers', () => {
  const toolbar = panelToolbarSource;

  assert.match(toolbar, /titleActionStyle = null/);
  assert.match(toolbar, /\.\.\.\(titleActionStyle \?\? null\)/);
});

test('Commit actions overflow before they can clip the mode tabs or branch chip', () => {
  const fit = new Function(`${extract('panelToolbarFit')}\nreturn panelToolbarFit;`)();

  assert.deepEqual(fit(200, 116, 0, 3, 34), { left: 0, right: 0 });
  assert.match(styles, /commitToolbarTitleAction:\s*\{\s*flex: '0 0 auto'/);
});
