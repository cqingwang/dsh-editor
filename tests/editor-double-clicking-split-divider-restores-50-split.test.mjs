import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('double-clicking the split divider restores the 50/50 split', () => {
  /* Dragging the divider is fiddly on a narrow dock; IDEA gives you a way back to
     the default with one gesture instead of eyeballing the ratio. */
  const start = source.indexOf("title: t('editor.terminalSplitReset')");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1800);
  assert.match(block, /onDoubleClick: \(\) => \{/);
  assert.match(block, /setSplitPercent\(50\)/);
  /* The new ratio has to be persisted, or the next reload brings the old one back. */
  assert.match(block, /commitSplitPercent\(50\)/);
});

test('the divider advertises the reset in its tooltip', () => {
  assert.equal(source.split('terminalSplitReset').length - 1, 3);
  const start = source.indexOf("title: t('editor.terminalSplitReset')");
  const block = source.slice(start, start + 400);
  assert.match(block, /t\('editor\.terminalSplitReset'\)/);
});
