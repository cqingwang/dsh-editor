import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function commitPanelBody() {
  const start = source.indexOf('function CommitPanel(');
  const end = source.indexOf('export { CommitPanel };', start);
  assert.notEqual(start, -1, 'CommitPanel is missing');
  assert.notEqual(end, -1, 'CommitPanel end marker is missing');
  return source.slice(start, end);
}

test('the commit status strip renders outside the tab switch', () => {
  const panel = commitPanelBody();
  const stripAt = panel.indexOf('styles.commitStatusStack');
  /* CommitLog is now kept mounted, so this is the tab's content boundary. */
  const logBranchAt = panel.indexOf('<CommitLog');
  assert.ok(stripAt > 0, 'status strip missing');
  /* It must come BEFORE the log surface, so the Log tab shows it too. */
  assert.ok(stripAt < logBranchAt, 'status strip must render before the tab branch');
  assert.match(panel, /error !== null \|\|[\s\S]*?notice !== null \|\|[\s\S]*?gitNotManaged \|\|[\s\S]*?pushFailure !== null && pushFailure !== undefined/u);
});

test('the changes tab no longer duplicates the status strip', () => {
  const panel = commitPanelBody();
  /* Exactly one strip, otherwise a failure shows twice in the Changes tab. */
  assert.equal((panel.match(/styles\.commitStatusStack/gu) ?? []).length, 1);
  assert.equal((panel.match(/styles\.commitError,\s+display:/gu) ?? []).length, 1);
  /* The identity warning stays local to the message box area. */
  assert.match(panel, /t\('editor\.identityMissing'\)/);
});

test('a failed cherry-pick surfaces git\'s own reason in the log tab', () => {
  const client = source;
  /* The host prefixes the failure, so the panel only has to render it. */
  assert.match(client, /setCommitError\(failure instanceof Error \? failure\.message : String\(failure\)\)/);
  const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
  assert.match(host, /cherry-pick stopped: /);
  assert.match(host, /revert stopped: /);
  assert.match(host, /'dsh-editor\/git-conflict'/);
});
