import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance. */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const pickMenuIcon = load('pickMenuIcon');
const isWorkspaceMenu = load('isWorkspaceMenu');

test('an icon whose sprite is missing falls back instead of rendering blank', () => {
  /* `dsw-icon-window-outline-regular` does not exist in the host sprite: the row
     rendered an empty 16px gap. Verify a fallback that is known to exist. */
  const available = new Set(['dsw-icon-panel-left-outline-regular', 'dsw-icon-edit-outline-regular']);
  assert.equal(pickMenuIcon(['dsw-icon-window-outline-regular', 'dsw-icon-panel-left-outline-regular'], available), 'dsw-icon-panel-left-outline-regular');
  /* Nothing preferred is available: keep the row's original icon rather than blank. */
  assert.equal(pickMenuIcon(['nope'], available), null);
  assert.equal(pickMenuIcon([], available), null);
  assert.equal(pickMenuIcon(['dsw-icon-panel-left-outline-regular'], available), 'dsw-icon-panel-left-outline-regular');
});

test('the injected row uses the split-panel glyph and checks the sprite first', () => {
  const start = source.indexOf('function ensureWorkspaceEditorItem(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 4000);
  assert.match(block, /pickMenuIcon\(/);
  assert.match(block, /dsw-icon-panel-left-outline-regular/);
  /* Retargeting a <use> to a missing symbol renders nothing at all. */
  assert.match(block, /querySelector\(`#\$\{/);
});

test('the detector also recognises the English menu and rejects the session menu', () => {
  /* Host locale keys (zh / en): workspace = Rename + Delete workspace;
     session = Pin / Rename⌥⌘G / Fork / Copy ID / Reveal / Archive. */
  assert.equal(isWorkspaceMenu(['Rename', 'Reveal in Finder', 'Delete workspace']), true);
  assert.equal(isWorkspaceMenu(['Pin session', 'Rename⌥⌘G', 'Fork session⇧⌘F', 'Copy Session ID', 'Reveal in Finder', 'Archive session⌥⌘A']), false);
  /* A shortcut suffix must not make the session menu look like the workspace one. */
  assert.equal(isWorkspaceMenu(['重命名⌥⌘G', '在 Finder 中显示', '归档会话⌥⌘A']), false);
});
