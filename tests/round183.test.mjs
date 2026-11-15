import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('a blank conversation exposes the Editor before any View tab exists', () => {
  assert.match(source, /\[data-slot="conversation\.hero\.options"\]/);
  assert.match(source, /function ensureHeroLaunch\(\)/);
  assert.match(source, /heroLaunch\.setAttribute\('data-dsh-editor-launch', ''\)/);
  assert.match(source, /if \(active\) setActive\(false\);\s*else openEditorSplit\(\);/);
  assert.match(source, /heroLaunch\.setAttribute\('aria-pressed', active \? 'true' : 'false'\)/);
});

test('the Editor is not injected into the host Chat/Context/Trajectory tab row', () => {
  assert.doesNotMatch(source, /setAttribute\('data-dsh-editor-tab'/);
  assert.doesNotMatch(source, /function ensureButton\(/);
  assert.doesNotMatch(source, /tablist\.insertBefore\(button/);
});

test('without a tab strip, sync still reconciles the editor host and hero launcher', () => {
  const start = source.indexOf('function syncInner()');
  assert.notEqual(start, -1);
  const end = source.indexOf('/**\n       * Insert an "Editor" item', start);
  assert.notEqual(end, -1);
  const body = source.slice(start, end);
  assert.match(body, /if \(tablist !== null\) \{/);
  assert.match(body, /ensureHeroLaunch\(\);/);
  assert.match(body, /const body = findBody\(\);/);
  assert.match(body, /if \(active\) \{/);
  assert.doesNotMatch(
    body,
    /if \(tablist === null\) \{\s*button = null;\s*return;/,
    'the old early return strands blank conversations',
  );
});

test('the chat opens at the Gufa-like reading width instead of a quarter strip', () => {
  assert.match(source, /const CHAT_WIDTH_MIN = 28;/);
  assert.match(source, /const CHAT_WIDTH_MAX = 44;/);
  assert.match(source, /const CHAT_WIDTH_DEFAULT = 35;/);
  assert.match(source, /dsh-editor\.chatWidth\.v2/);
  assert.match(source, /Math\.abs\(value - 25\) > 0\.01/);
});

test('the blank-session action is localized and styled with host tokens', () => {
  assert.equal(source.split("openEditor: '").length - 1, 2);
  const start = source.indexOf('function ensureHeroLaunch()');
  const end = source.indexOf('function applyChatWidth(', start);
  const block = source.slice(start, end);
  assert.match(block, /var\(--dsw-alias-border-l2, var\(--dsw-alias-border-l3\)\)/);
  assert.match(block, /var\(--dsw-alias-label-secondary\)/);
  assert.match(block, /dsw-icon-panel-left-outline-regular/);
});
