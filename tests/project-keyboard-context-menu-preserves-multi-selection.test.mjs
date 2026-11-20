import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

const handlerStart = panel.indexOf('const openSelectedContextMenuFromKeyboard = () => {');
const handlerEnd = panel.indexOf('const gitChanges = React.useMemo(', handlerStart);
const handler = panel.slice(handlerStart, handlerEnd);

test('the keyboard Project context menu preserves an existing multi-selection', () => {
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'keyboard Project context menu handler must exist');
  assert.match(
    handler,
    /if \(!selection\.has\(selected\.path\)\) selectVisibleRow\(selected, \{\}\);/u,
  );
  assert.doesNotMatch(handler, /^\s*selectVisibleRow\(selected, \{\}\);\s*$/mu);
});
