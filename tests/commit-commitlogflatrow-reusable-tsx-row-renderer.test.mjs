import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitLogFlatRow is a reusable TSX row renderer', async () => {
  const row = await read('src/client/components/commit/CommitLogFlatRow.tsx');

  assert.match(row, /interface CommitLogFlatRowProps/u);
  assert.match(row, /function CommitLogFlatRow\(/u);
  assert.match(row, /role='option'/u);
  assert.match(row, /data-dsh-log-hash=\{commit\.hash\}/u);
  assert.match(row, /aria-haspopup='menu'/u);
  assert.match(row, /aria-selected=\{selectionIncluded\}/u);
  assert.match(row, /data-dsh-log-new/u);
  assert.match(row, /formatCommitDate\(commit\.date\)/u);
  assert.doesNotMatch(row, /React\.createElement/u);
  assert.match(row, /export \{ CommitLogFlatRow \};/u);
});

test('CommitLog delegates flat rows while retaining selection and menu actions', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /import \{ CommitLogFlatRow \} from '\.\/CommitLogFlatRow'/u);
  assert.match(log, /<CommitLogFlatRow[\s\S]*?selectionIncluded=\{selectedCommits\.includes\(commit\.hash\)\}[\s\S]*?rowRef=/u);
  assert.match(log, /selectCommitRow\(\s*visible\.map\(\(entry\) => entry\.hash\),\s*commit\.hash,\s*event,/u);
  assert.match(log, /commitLogContextSelection\(selectedCommits, commit\.hash\)/u);
  assert.doesNotMatch(log, /data-dsh-log-hash=\{commit\.hash\}/u);
  assert.match(build, /CommitLogFlatRow\.tsx/u);
  assert.match(client, /function CommitLogFlatRow\(/u);
});
