import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8')) + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const commitLog = source.slice(
  source.indexOf('function CommitLogView({'),
  source.indexOf('const CommitLog = CommitLogView;'),
);

test('the Log list forwards one DOM node to both its local and scroll refs', () => {
  assert.match(
    commitLog,
    /const setLogListRef = React\.useCallback\(\s+\(node\) => \{\s+listRef\.current = node;\s+if \(logScrollRef !== null\) logScrollRef\.current = node;\s+\},\s+\[logScrollRef\],\s+\);/s,
  );
  assert.match(commitLog, /const logScrollRef = scrollRefs\?\.log \?\? null;/);
});

test('the Log list has one combined ref and no duplicated ref prop', () => {
  const listStart = commitLog.indexOf("className='dsh-editor-tool-scroll'");
  assert.notEqual(listStart, -1);
  const listProps = commitLog.slice(listStart, listStart + 800);
  assert.match(listProps, /ref=\{setLogListRef\}/);
  assert.doesNotMatch(listProps, /ref=\{listRef\}/);
  assert.doesNotMatch(listProps, /ref=\{scrollRefs\?\.log\}/);
});
