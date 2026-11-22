import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('commit metrics remain available without showing a counter row', () => {
  const client = read('lib/client.js');
  const commitModel = read('src/client/components/ui/commit-model.ts');
  assert.match(commitModel, /export function commitMetrics\(/);
  assert.ok(commitModel.includes("const newline = text.indexOf('\\n');"));
  assert.match(commitModel, /subjectLength: subject\.trimEnd\(\)\.length,/);
  assert.ok(commitModel.includes("bodyLines: body === '' ? 0 : body.trimEnd().split('\\n').length,"));
  assert.doesNotMatch(client, /styles\.commitCounterRow/);
  assert.doesNotMatch(client, /editor\.commitSubjectCount/);
});

test('a commit refreshes the log so the new row appears without a manual reload', () => {
  const client = read('lib/client.js');
  const commitAt = client.indexOf('const commit = React.useCallback(');
  const refreshAt = client.indexOf('await loadLog();', commitAt);
  assert.ok(refreshAt > commitAt, 'commit must await loadLog');
  assert.match(
    client,
    /\[amend, commitMessage, commitSelection, git, loadLog, reportGitFailure, root, switchCommitMode, t\]/,
  );
});

test('a change-tree directory carries its leaves and stages them in one action', () => {
  const client = `${read('src/client/components/commit/CommitPanel.tsx')}\n${read('lib/client.js')}`;
  assert.match(client, /const inside = collectChanges\(leaf, \[\]\);/);
  /* The row keeps the COMPACTED path (`a/b/c` renders as one row) and adds the
     parent path for the muted label beside the name. Its visible depth follows
     the expanded tree so nested files keep IDEA's hierarchy indent. */
  assert.match(
    client,
    /rows\.push\(\{\s+kind: 'directory',\s+path,\s+name: basename\(path\),\s+parent: dirname\(path\),\s+depth,\s+open,\s+collapseKey: key,\s+changes: inside,?\s+\}\);/u,
  );
  assert.match(client, /const inside = \(row\.changes \?\? \[\]\)\.map\(\(change\) => change\.path\);/);
  assert.match(client, /if \(group\.id === 'staged'\) onUnstage\(inside\);/);
  assert.match(client, /else onStage\(inside\);/);
});
