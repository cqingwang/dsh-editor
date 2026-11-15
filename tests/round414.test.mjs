import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commitLog = source.slice(
  source.indexOf('function CommitLog({'),
  source.indexOf('function formatCommitDate('),
);

test('switching commits resets both axes of the detail viewport', () => {
  assert.match(
    commitLog,
    /React\.useEffect\(\(\) => \{\s+const node = detailScrollRef\.current;\s+if \(node !== null\) \{\s+node\.scrollTop = 0;\s+node\.scrollLeft = 0;\s+\}\s+\}, \[detail\?\.hash\]\);/s,
  );
});

test('the dual-axis reset remains scoped to commit identity', () => {
  const start = commitLog.indexOf('const detailScrollRef = React.useRef(null);');
  const marker = '}, [detail?.hash]);';
  const end = commitLog.indexOf(marker, start);
  assert.notEqual(end, -1);
  const block = commitLog.slice(start, end + marker.length);
  assert.match(block, /\[detail\?\.hash\]/);
  assert.doesNotMatch(block, /\[detail\]/);
});
