import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  const end = source.indexOf('function NamePrompt(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Commit tool window renders its built-in UI in IDEA English', () => {
  assert.match(source, /const englishMessages = flattenDictionary\(en\);/);
  assert.match(source, /const commitEnglish = \(key, params\) => \{[\s\S]*?englishMessages\[key\][\s\S]*?return interpolateMessage\(text, params\);/);
  assert.match(source, /React\.createElement\(CommitPanel, \{\s+t: commitEnglish,/s);
  assert.match(source, /const fileCountText = \(count\) => count === 1 \? '1 file' : t\('editor\.filesCount', \{ count \}\);/);
  assert.equal(source.match(/fileCountText\(/g)?.length, 2);
});

test('Change file rows omit porcelain M/U badges like IDEA', () => {
  const panel = commitPanel();
  const rowStart = panel.indexOf("const change = row.change;");
  const rowEnd = panel.indexOf("React.createElement(LineCounts, {", rowStart);
  assert.notEqual(rowStart, -1);
  assert.notEqual(rowEnd, -1);
  const row = panel.slice(rowStart, rowEnd);

  assert.doesNotMatch(row, /statusBadge/);
  assert.doesNotMatch(row, /const info = gitStatusInfo/);
  assert.match(source, /gridTemplateColumns: '12px 16px 16px max-content minmax\(0, 1fr\) max-content'/);
});

test('Change tree rows retain visible hierarchy depth instead of one flat indent', () => {
  assert.match(source, /rows\.push\(\{ kind: 'directory', path, name: basename\(path\), parent: dirname\(path\), depth, open,/);
  assert.match(source, /rows\.push\(\{ kind: 'file', path: change\.path, name: basename\(change\.path\), depth, change \}\);/);
  assert.match(source, /paddingLeft: 22 \+ row\.depth \* 14/);
  assert.equal(source.match(/paddingLeft: 22 \+ row\.depth \* 14/g)?.length, 2);
});
