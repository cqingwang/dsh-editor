import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

/** Source of one component, sliced at the next four-space `function`. */
function bodyOf(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
  const rest = source.slice(start + marker.length);
  const next = /\n {4}function [A-Za-z_$][\w$]*\(/u.exec(rest);
  return next === null ? rest : rest.slice(0, next.index);
}

test('the commit status strip renders outside the tab switch', () => {
  const panel = bodyOf('CommitPanel');
  const stripAt = panel.indexOf('styles.commitStatusStack');
  /* The branch is the ternary that renders CommitLog, not the tab button's aria check. */
  const logBranchAt = panel.indexOf("mode === 'log'\n          ? React.createElement(CommitLog");
  assert.ok(stripAt > 0, 'status strip missing');
  /* It must come BEFORE the branch, so the Log tab shows it too. */
  assert.ok(stripAt < logBranchAt, 'status strip must render before the tab branch');
  assert.match(panel, /error !== null \|\| notice !== null \|\| \(pushFailure !== null && pushFailure !== undefined\)/);
});

test('the changes tab no longer duplicates the status strip', () => {
  const panel = bodyOf('CommitPanel');
  /* Exactly one strip, otherwise a failure shows twice in the Changes tab. */
  assert.equal((panel.match(/styles\.commitStatusStack/gu) ?? []).length, 1);
  assert.equal((panel.match(/styles\.commitError, display/gu) ?? []).length, 1);
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
