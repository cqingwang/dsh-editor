import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const injectedCss = await readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8');

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  const end = source.indexOf('export { CommitPanel };', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('all Changes tree levels participate in the same IDEA hover surface', () => {
  const panel = commitPanel();
  assert.equal(panel.match(/dsh-editor-change-tree-row/g)?.length, 3);
  assert.match(injectedCss, /\.dsh-editor-change-tree-row:hover \{ background: var\(--dsw-alias-interactive-bg-hover\); \}/);
});

test('the primary selected Change keeps its stronger fill while hovered', () => {
  const panel = commitPanel();
  assert.match(panel, /\.\.\.\(selectedInRange && !selectedForChange \? styles\.commitFileRowRange : null\)/);
  assert.match(panel, /\.\.\.\(selectedForChange \? styles\.commitFileRowSelected : null\)[\s\S]*?\.\.\.\(selectedInRange && !selectedForChange \? styles\.commitFileRowRange : null\)/);
});
