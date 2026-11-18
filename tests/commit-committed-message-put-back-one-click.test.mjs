import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { menuSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('a committed message can be put back with one click', () => {
  assert.match(source, /const \[clearedMessage, setClearedMessage\] = React\.useState\(''\);/);
  assert.match(source, /setClearedMessage\(commitMessage\);/);
  assert.match(source, /const restoreClearedMessage = React\.useCallback\(\(\) => \{/);
  /* "Undo" restores the text and the draft, but never the commit itself. */
  assert.match(source, /setCommitMessage\(clearedMessage\);/);
  assert.match(source, /writeCommitDraft\(root, clearedMessage\);/);
  assert.match(source, /t\('editor\.undoClearedMessage'\)/);
});

test('push has its own busy flag so committing stays possible', () => {
  assert.match(source, /const \[pushBusy, setPushBusy\] = React\.useState\(false\);/);
  const pushAt = source.indexOf('const pushNow = React.useCallback(');
  const pushEnd = source.indexOf('}, [t]);', pushAt);
  const body = source.slice(pushAt, pushEnd);
  /* The standalone push must not touch the commit busy flag. */
  assert.equal(body.includes('setCommitBusy'), false);
  assert.match(body, /setPushBusy\(true\);/);
  assert.match(body, /setPushBusy\(false\);/);
  assert.match(source, /pushing \? t\('editor\.pushing'\) : t\('editor\.retryPush'\)/);
});

test('copy-as-path:line only quotes the caret of the file actually open', () => {
  assert.match(source, /id: 'copyPosition',/);
  /* Quoting another file's caret would point at the wrong place (round 104 moved the
     whole decision into `pathWithLine`, which also drops the caret when it is null). */
  assert.match(source, /function pathWithLine\(path, caret, isActive\)/);
  assert.match(
    source,
    /run: \(\) => write\(\s*pathWithLine\(\s*firstPath,\s*editor\?\.getPosition\?\.\(\) \?\? null,\s*editorPath === firstPath\s*\)\s*\)/u,
  );
});

test('a multi-row context menu reports how many rows it will touch', () => {
  assert.match(source, /title: batch\.length > 1 \? t\('editor\.selectionCount', \{ count: batch\.length \}\) : null,/);
  assert.match(
    menuSource,
    /menu\.title \? \([\s\S]*?style=\{styles\.menuTitle\}[\s\S]*?role='presentation'[\s\S]*?\{menu\.title\}/,
  );
  /* Single-row actions are disabled while a bulk action is what runs. */
  assert.match(source, /disabled: isRoot \|\| batch\.length > 1,/);
});
