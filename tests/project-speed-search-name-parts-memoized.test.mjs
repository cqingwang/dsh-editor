import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const project = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');

test('Project speed-search name parts are derived once per visible result set', () => {
  assert.match(project, /const projectNamePartsByPath = React\.useMemo\(/u);
  assert.match(project, /highlightParts\(row\.name, search\)/u);

  const rowsStart = project.indexOf('{visibleRows.map((row, rowIndex) => {');
  const rowsEnd = project.indexOf('      </div>\n    </React.Fragment>', rowsStart);
  assert.ok(rowsStart > 0);
  assert.ok(rowsEnd > rowsStart);
  const rows = project.slice(rowsStart, rowsEnd);
  assert.match(rows, /projectNamePartsByPath\.get\(row\.path\)/u);
  assert.doesNotMatch(rows, /highlightParts\(/u);
});
