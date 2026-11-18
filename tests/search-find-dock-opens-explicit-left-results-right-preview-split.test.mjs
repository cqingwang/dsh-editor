import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
);

test('Find dock opens with an explicit left results and right preview split', () => {
  assert.match(findTool, /const \[previewOpen, setPreviewOpen\] = React\.useState\(true\)/);
  assert.match(findTool, /'data-dsh-find-results-layout': floating \? 'stack' : 'split'/);
  assert.match(findTool, /'data-dsh-find-results-pane': ''/);
  assert.match(source, /findToolDockSplit: \{[\s\S]*?display: 'flex'/);
  assert.match(source, /findToolDockResultsPane: \{[\s\S]*?minWidth: 0/);
  assert.match(
    source,
    /findToolDockPreviewPane: \{[\s\S]*?borderTop: 'none'[\s\S]*?borderLeft:/,
  );
});

test('A single click focuses the dock row and updates preview without opening', () => {
  const mouseDownBlocks = [...findTool.matchAll(/onMouseDown: \(event\) => \{([\s\S]*?)\n\s*\},/g)]
    .map((match) => match[1]);
  assert.ok(mouseDownBlocks.length >= 3);
  for (const block of mouseDownBlocks) {
    assert.match(block, /onMove\(0, occurrences\.length, position\)/);
    assert.match(block, /event\.currentTarget\.focus\?\.\(\)/);
    assert.doesNotMatch(block, /openFindResult\(/);
  }
});

test('Only double-click or Enter opens a Find result into the editor above', () => {
  assert.ok((findTool.match(/onDoubleClick: \(\) => openFindResult\(/g) ?? []).length >= 3);
  assert.match(
    findTool,
    /event\.key === 'Enter'[\s\S]{0,180}openFindResult\(occurrences\[position\]\)/,
  );
});

test('The dock preview remains present without an active row and explains the empty state', () => {
  assert.match(findTool, /previewOpen && \(floating \? active !== null && hasFindToolContentQuery\(query\) : true\)/);
  assert.match(findTool, /previewState\.path \|\| t\('editor\.findToolPreviewSource'\)/);
  assert.match(findTool, /active === null[\s\S]{0,220}t\('editor\.findToolPreviewSelectResult'\)/);
});
