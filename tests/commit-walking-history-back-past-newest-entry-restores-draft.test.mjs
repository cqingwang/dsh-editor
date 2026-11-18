import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8'),
].join('\n');

test('walking the history back past the newest entry restores the draft', () => {
  assert.match(source, /const draftBeforeRecall =\s+React\.useRef\(null\);/);
  /* The draft is captured the moment the walk starts, before any history text replaces it. */
  assert.match(
    source,
    /historyIndex === -1 &&\s+draftBeforeRecall\.current === null\s*\)\s*draftBeforeRecall\.current = commitMessage;/,
  );
  /* Landing on index -1 restores the draft instead of blanking the box. */
  assert.match(source, /if \(next < 0\) setCommitMessage\(draftBeforeRecall\.current \?\? ''\);/);
  assert.match(source, /else setCommitMessage\(messageHistory\[next\]\);/);
});

test('typing again ends the recall walk and forgets the saved draft', () => {
  assert.match(source, /draftBeforeRecall\.current =\s+null;/);
  const onMessageAt = source.indexOf('onMessage={(value) => {');
  const block = source.slice(onMessageAt, source.indexOf('history={messageHistory}', onMessageAt));
  assert.match(block, /setHistoryIndex\(-1\);/);
  /* Once the user types, the old draft is theirs no longer. */
  assert.match(block, /draftBeforeRecall\.current =\s+null;/);
});

test('the terminal find bar reopens with the previous query', () => {
  assert.match(source, /const lastTerminalQuery = React\.useRef\(''\);/);
  assert.match(source, /const openTerminalFind = \(emulator\) => \{/);
  assert.match(source, /const query = lastTerminalQuery\.current;/);
  /* The count is recomputed for the restored query rather than trusted from before. */
  assert.match(
    source,
    /const total =\s+query === '' \|\| emulator === null \|\| emulator === undefined \? 0 : countTerminalMatches\(emulator, query\);/,
  );
  assert.match(source, /lastTerminalQuery\.current = find\.query;/);
  assert.match(source, /onClick=\{\(\) => openTerminalFind\(emulatorRef\.current\)\}/);
});

test('⌘F reopens the find bar without clobbering an open one', () => {
  assert.match(source, /const findRef = React\.useRef\(null\);/);
  assert.match(source, /if \(findRef\.current === null\)\s+openTerminalFind\(/);
  /* The ref must be declared after the state it mirrors, or the render hits the TDZ. */
  const stateAt = source.indexOf('const [find, setFind] = React.useState(null);');
  const refAt = source.indexOf('const findRef = React.useRef(null);');
  assert.ok(stateAt > 0 && refAt > stateAt);
});
