import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the file tab chevron is pinned to the strip edge', () => {
  /* IDEA's `»` sits at the right end of the tab bar; a chevron that slides with
     the tab count is a moving target for the mouse. */
  const start = source.indexOf('      tabOverflow: {');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('      tabActive: {', start));
  assert.match(block, /marginLeft: 'auto'/);
});

test('the terminal chevron stays next to the last tab', () => {
  /* The terminal tab container itself grows, so `auto` there would glue the
     chevron to the toolbar's edge, away from the tabs it belongs to. */
  const start = source.indexOf('      terminalOverflow: {');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('      terminalTab: {', start));
  assert.match(block, /marginLeft: 2/);
  assert.doesNotMatch(block, /marginLeft: 'auto'/);
});

test('the change-tree directory menu opens a shell in that directory', () => {
  const start = source.indexOf('const buildChangeDirMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('/* Apply a rename from the inline editor row. */', start));
  /* IDEA's directory actions include "Open in Terminal"; the commit tree needs it
     too, because that is where you go looking when a folder fails to stage. */
  assert.match(block, /t\('editor\.openInTerminal'\)/);
  assert.match(block, /run: \(\) => openInTerminal\(directory\)/);
  /* The callback must list its new dependency, or it captures a stale one. */
  assert.match(block, /\[openInTerminal, restage, revealPath, rollback, t\]/);
});
