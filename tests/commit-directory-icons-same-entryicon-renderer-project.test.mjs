import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  const end = source.indexOf('export { CommitPanel };', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Commit directory icons use the same EntryIcon renderer as Project', () => {
  const panel = commitPanel();
  assert.match(
    panel,
    /<EntryIcon\s+entry=\{\{\s+path: row\.path,\s+kind: 'directory',\s+root: false,\s+\}\}\s+expanded=\{row\.open\}\s+\/>/u,
  );
  assert.doesNotMatch(panel, /<Icon\s+name=\{row\.open \? 'folderOpen' : 'folder'\}\s+size=\{14\}/u);
});

test('the commit subject counter and short-subject warning row are removed', () => {
  const panel = commitPanel();
  assert.doesNotMatch(panel, /styles\.commitCounterRow/);
  assert.doesNotMatch(panel, /editor\.commitSubjectCount/);
  assert.doesNotMatch(panel, /editor\.commitSubjectShort/);
  assert.doesNotMatch(panel, /const metrics = commitMetrics\(message\);/);
});

test('commit template chips stay in one adaptive row', () => {
  assert.match(
    source,
    /commitTemplateRow: \{[\s\S]*?containerType: 'inline-size'[\s\S]*?flexWrap: 'nowrap'[\s\S]*?gap: 2[\s\S]*?overflow: 'hidden'/,
  );
  assert.match(
    source,
    /commitTemplateChip: \{[\s\S]*?flex: '1 1 auto'[\s\S]*?minWidth: 0[\s\S]*?fontSize: EDITOR_RESPONSIVE_FONT_SIZE\.commitChip/,
  );
  assert.match(source, /whiteSpace: 'nowrap'/);
});
