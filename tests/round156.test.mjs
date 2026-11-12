import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('a block restore is undoable from the diff toolbar and ⌘Z', () => {
  const client = read('lib/client.js');
  /* Monaco clears its model undo stack when the native revert edits the model;
     the plugin therefore keeps an explicit inverse. */
  assert.match(client, /const restoreUndoRef = undoRef \?\? React\.useRef\(\[\]\);/);
  assert.match(client, /const undoRestore = React\.useCallback\(\(\) => \{/);
  assert.match(client, /restoreUndoRef\.current\.pop\(\)/);
  assert.match(client, /label: t\('editor\.diffUndoRestore'\), onClick: undoRestore/);
  assert.match(client, /case 'undo':/);
  assert.match(client, /icon: 'undo', label: t\('editor\.diffUndoRestore'\)/);
  assert.match(client, /const \[undoNotice, setUndoNotice\] = React\.useState\(null\);/);
  assert.match(client, /undoNotice \?\? t\(target\?\.staged === true \? 'editor\.diffRestoreHintStaged' : 'editor\.diffRestoreHint'\)/);
  assert.match(client, /event\.key\.toLowerCase\(\) === 'z'/);
  assert.match(client, /undoRestore\(\);/);
});

test('one user restore creates one undo entry despite duplicate model events', () => {
  const client = read('lib/client.js');
  /* The restore's write chain must not drop a second event while the first is
     in flight: that left the model and the file disagreeing after ⌘Z. */
  assert.match(client, /const writeChainRef = React\.useRef\(Promise\.resolve\(\)\);/);
  assert.match(client, /writeChainRef\.current = writeChainRef\.current/);
  assert.match(client, /activeRestoreRef\.current = restoreRecord;/);
  assert.match(client, /restoreUndoRef\.current\.push\(restoreRecord\);/);
  assert.doesNotMatch(client, /savingRef/);
  /* Inline parent callbacks must not be effect dependencies, or a status
     update wipes the undo stack by reloading the diff. */
  assert.match(client, /const onRestoredRef = React\.useRef\(onRestored\);/);
  assert.match(client, /const onStatusRef = React\.useRef\(onStatus\);/);
  assert.match(client, /\}, \[t\]\);/);
});

test('read-only comparisons get no restore or undo affordance', () => {
  const client = read('lib/client.js');
  assert.match(client, /const writable = typeof target\.clipboardText !== 'string' && typeof target\.revision !== 'string' && typeof target\.commit !== 'string';/);
  assert.match(client, /diff\.updateOptions\(\{\n\s+readOnly: writable === false,\n\s+renderMarginRevertIcon: writable,/);
  assert.match(client, /typeof target\?\.commit === 'string' \|\| typeof target\?\.revision === 'string' \|\| typeof target\?\.clipboardText === 'string'/);
});

test('restore feedback and undo affordances are bilingual', () => {
  const client = read('lib/client.js');
  for (const key of ['diffUndoRestore', 'diffUndoEmpty', 'diffUndoDone']) {
    const matches = [...client.matchAll(new RegExp(`${key}:`, 'g'))];
    assert.equal(matches.length, 2, `${key} must exist once in zh and once in en`);
  }
});

test('redo restores the last undone block and clears on a new restore', () => {
  const client = read('lib/client.js');
  assert.match(client, /const restoreRedoRef = redoRef \?\? React\.useRef\(\[\]\);/);
  assert.match(client, /const redoRestore = React\.useCallback\(\(\) => \{/);
  assert.match(client, /restoreRedoRef\.current\.push\(entry\);/);
  assert.match(client, /restoreRedoRef\.current = \[\];/);
  assert.match(client, /case 'redo':/);
  assert.match(client, /icon: 'redo', label: t\('editor\.diffRedoRestore'\)/);
  assert.match(client, /event\.key\.toLowerCase\(\) === 'y'/);
  for (const key of ['diffRedoRestore', 'diffRedoEmpty', 'diffRedoDone']) {
    const matches = [...client.matchAll(new RegExp(`${key}:`, 'g'))];
    assert.equal(matches.length, 2, `${key} must exist once in zh and once in en`);
  }
});

test('selection restore only targets changed character ranges', () => {
  const client = read('lib/client.js');
  assert.match(client, /function selectedCharChanges\(changes, selection\) \{/);
  assert.match(client, /diff\.revertRangeMappings\(ranges\)/);
  assert.match(client, /originalRange: \{/);
  assert.match(client, /modifiedRange: \{/);
  assert.match(client, /editor\.onDidChangeCursorSelection/);
  assert.match(client, /icon: 'target', label: t\('editor\.diffSelectionRestore'\)/);
  assert.match(client, /event\.selection/);

  /* Execute the pure range selector against a realistic char-change payload. */
  const source = read('lib/client.js');
  const start = source.indexOf('    function selectedCharChanges(');
  assert.notEqual(start, -1);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const fn = new Function(`${source.slice(start, index + 1)}; return selectedCharChanges;`)();
  const changes = [{
    charChanges: [
      { originalStartLineNumber: 2, originalStartColumn: 1, originalEndLineNumber: 2, originalEndColumn: 5, modifiedStartLineNumber: 2, modifiedStartColumn: 1, modifiedEndLineNumber: 2, modifiedEndColumn: 5 },
      { originalStartLineNumber: 8, originalStartColumn: 1, originalEndLineNumber: 8, originalEndColumn: 5, modifiedStartLineNumber: 8, modifiedStartColumn: 1, modifiedEndLineNumber: 8, modifiedEndColumn: 5 },
    ],
  }];
  const hit = fn(changes, { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 5 });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].modifiedStartLineNumber, 2);
  assert.deepEqual(fn(changes, { startLineNumber: 4, startColumn: 1, endLineNumber: 4, endColumn: 3 }), []);
  assert.deepEqual(fn(changes, null), []);

  /* Monaco reports a line replacement as an end column of 1 on the NEXT line. */
  assert.equal(fn([{
    charChanges: [{
      originalStartLineNumber: 2, originalStartColumn: 1, originalEndLineNumber: 3, originalEndColumn: 1,
      modifiedStartLineNumber: 2, modifiedStartColumn: 1, modifiedEndLineNumber: 3, modifiedEndColumn: 1,
    }],
  }], { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 5 }).length, 1);
  assert.equal(fn([{
    charChanges: [{
      originalStartLineNumber: 8, originalStartColumn: 1, originalEndLineNumber: 9, originalEndColumn: 1,
      modifiedStartLineNumber: 8, modifiedStartColumn: 1, modifiedEndLineNumber: 9, modifiedEndColumn: 1,
    }],
  }], { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 5 }).length, 0);
});

test('Commit opens at one quarter and remembers a dragged width per workspace', () => {
  const client = read('lib/client.js');
  assert.match(client, /const \[toolWidths, setToolWidths\] = React\.useState\(\{ project: 26, commit: 25 \}\);/);
  assert.match(client, /function readToolWidth\(root, activity, fallback\) \{/);
  assert.match(client, /dsh-editor\.toolWidth\.\$\{activity\}:\$\{root\}/);
  assert.match(client, /writeToolWidth\(rootRef\.current, activity, final\)/);
  assert.match(client, /toolWidthsRef\.current\[activity\] \?\? startWidth/);
  assert.match(client, /commit: readToolWidth\(value\.root \?\? '', 'commit', 25\)/);
  assert.match(client, /project: readToolWidth\(value\.root \?\? '', 'project', 26\)/);
});

test('the quarter-width diff keeps its glyph gutter but compacts text chrome', () => {
  const client = read('lib/client.js');
  assert.match(client, /lineNumbersMinChars: 2/);
  assert.match(client, /lineDecorationsWidth: 4/);
  assert.match(client, /glyphMargin: writable \|\|/);
  assert.match(client, /dsh-editor-diff-view-label/);
  /* The selector may share the container rule with the hidden path hint; the
     behaviour that matters is that the mode label is hidden at 440px. */
  assert.match(client, /@container dsh-editor-editor \(max-width: 440px\) \{ \.dsh-editor-diff-view-label[^}]*\{ display: none/);
});

test('a staged diff says the restore only changes the index', () => {
  const client = read('lib/client.js');
  assert.match(client, /diffRestoreHintStaged: '点击右侧的 ▸ 只把暂存区中的这一块还原为左侧内容（不改工作区）'/);
  assert.match(client, /diffRestoreHintStaged: 'Click the ▸ on the right to restore this block in the index only/);
  assert.match(client, /undoNotice \?\? t\(target\?\.staged === true \? 'editor\.diffRestoreHintStaged' : 'editor\.diffRestoreHint'\)/);
});

test('restore history survives switching between diff targets', () => {
  const client = read('lib/client.js');
  /* The model effect no longer clears the stacks; the refs live in the
     workspace so IDEA's global undo/redo behaves the same across files. */
  assert.match(client, /const diffUndoRef = React\.useRef\(\[\]\);/);
  assert.match(client, /const diffRedoRef = React\.useRef\(\[\]\);/);
  assert.match(client, /undoRef: diffUndoRef,/);
  assert.match(client, /redoRef: diffRedoRef,/);
  assert.match(client, /undoRef \?\? React\.useRef\(\[\]\)/);
  assert.match(client, /redoRef \?\? React\.useRef\(\[\]\)/);
  /* Loading a different model must not reset history; a NEW restore still
     clears redo, which is standard editor semantics. */
  const modelSwap = client.slice(client.indexOf('diff.setModel({ original, modified });'), client.indexOf('setState({ binary: false, error: null, missing: value.missing });'));
  assert.doesNotMatch(modelSwap, /restoreUndoRef\.current = \[\];/);
  assert.doesNotMatch(modelSwap, /restoreRedoRef\.current = \[\];/);
  assert.match(client, /const applyHistoryEntry = React\.useCallback\(\(entry, redo\) => \{/);
  assert.match(client, /path: entry\.path,/);
  assert.match(client, /side: entry\.side,/);
  assert.match(client, /active\.path !== entry\.path \|\| active\.side !== entry\.side/);
  /* A null placeholder is not a disposable; switching files used to call
     `.dispose()` on it and blank the diff. */
  assert.match(client, /__dshFallbackUndo != null/);
  assert.doesNotMatch(client, /__dshFallbackUndo = null;/);
});
