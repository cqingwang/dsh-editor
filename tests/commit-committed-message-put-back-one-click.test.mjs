import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { menuSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const commitPanel = readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8');
const injectedCss = readFileSync(join(root, 'src/client/injected-css.ts'), 'utf8');

test('a committed message can be put back with one click', () => {
  assert.match(workspace, /const \[clearedMessage, setClearedMessage\] =\s+React\.useState\(''\);/u);
  assert.match(workspace, /setClearedMessage\(commitMessage\);/);
  assert.match(workspace, /const restoreClearedMessage = React\.useCallback\(\(\) => \{/);
  /* "Undo" restores the text and the draft, but never the commit itself. */
  assert.match(workspace, /setCommitMessage\(clearedMessage\);/);
  assert.match(workspace, /writeCommitDraft\(root, clearedMessage\);/);
  assert.match(commitPanel, /t\('editor\.undoClearedMessage'\)/);
});

test('push has its own busy flag so committing stays possible', () => {
  assert.match(workspace, /const \[pushBusy, setPushBusy\] =\s+React\.useState\(false\);/u);
  const pushAt = workspace.indexOf('const pushNow = React.useCallback(');
  const pushEnd = workspace.indexOf('}, [reportGitFailure, t]);', pushAt);
  const body = workspace.slice(pushAt, pushEnd);
  /* The standalone push must not touch the commit busy flag. */
  assert.equal(body.includes('setCommitBusy'), false);
  assert.match(body, /setPushBusy\(true\);/);
  assert.match(body, /setPushBusy\(false\);/);
  assert.match(commitPanel, /pushing \? t\('editor\.pushing'\) : t\('editor\.retryPush'\)/);
});

test('copy-as-path:line only quotes the caret of the file actually open', () => {
  assert.match(injectedCss, /id: 'copyPosition',/);
  /* Quoting another file's caret would point at the wrong place (round 104 moved the
     whole decision into `pathWithLine`, which also drops the caret when it is null). */
  assert.match(injectedCss, /function pathWithLine\(/);
  assert.match(
    injectedCss,
    /run: \(\) => write\(\s*pathWithLine\(\s*firstPath,\s*editor\?\.getPosition\?\.\(\) \?\? null,\s*editorPath === firstPath\s*\)\s*\)/u,
  );
});

test('a multi-row context menu reports how many rows it will touch', () => {
  assert.match(
    workspace,
    /title:\s+batch\.length > 1 \? t\('editor\.selectionCount', \{ count: batch\.length \}\) : null,/u,
  );
  assert.match(
    menuSource,
    /menu\.title \? \([\s\S]*?style=\{styles\.menuTitle\}[\s\S]*?role='presentation'[\s\S]*?\{menu\.title\}/,
  );
  /* Single-row actions are disabled while a bulk action is what runs. */
  assert.match(workspace, /disabled: isRoot \|\| batch\.length > 1,/);
});
