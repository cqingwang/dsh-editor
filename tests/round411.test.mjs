import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commitLog = source.slice(
  source.indexOf('function CommitLog({'),
  source.indexOf('function formatCommitDate('),
);

test('switching commits resets the detail pane to the first line', () => {
  assert.match(commitLog, /const detailScrollRef = React\.useRef\(null\);/);
  assert.match(commitLog, /React\.useEffect\(\(\) => \{\s+const node = detailScrollRef\.current;\s+if \(node !== null\) \{\s+node\.scrollTop = 0;/s);
  assert.match(commitLog, /ref: detailScrollRef,/);
  assert.match(commitLog, /tabIndex: 0,\s+role: 'region',/s);
});

test('the reset is scoped to commit identity, not every detail rerender', () => {
  assert.match(commitLog, /\}, \[detail\?\.hash\]\);/);
  assert.doesNotMatch(commitLog, /\}, \[detail\]\);\s+React\.createElement\(\s+'div',\s+\{\s+style: styles\.commitLogBody/s);
});
