import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Evaluate one module-level helper from the client bundle.
 * @param {string} name - helper to load.
 * @returns {Function} the shipping implementation.
 */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`'use strict';\n${source.slice(start, index + 1)}\nreturn ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the create row offers an explicit parent directory choice', () => {
  assert.match(source, /const directoryChoices = React\.useMemo\(\(\) => \{/);
  assert.match(source, /const seen = new Set\(\[''\]\);/);
  /* The root is always first, whatever the tree happens to contain. */
  assert.match(source, /const choices = \[\{ path: '', name: projectName \}\];/);
  assert.match(source, /style: styles\.createParentSelect,/);
  assert.match(source, /onCreateParent: \(parent\) => setCreateState/);
  assert.match(source, /t\('editor\.createIn'\)/);
});

test('a terminal offers both "clear screen" and "clear scrollback"', () => {
  assert.match(source, /onClearBuffer: \(\) => \{/);
  /* Clearing the screen keeps history; dropping the scrollback must be its own action. */
  assert.match(source, /emulator\.reset\(\);/);
  assert.match(source, /id: 'clearBuffer', label: t\('editor\.terminalClearBuffer'\), danger: true/);
  /* Round 70 spells the difference out and shows the ⌘K shortcut. */
  assert.match(source, /\{ id: 'clear', label: t\('editor\.terminalClear'\), shortcut: '⌘K', run: onClear \},/);
  assert.match(source, /function terminalMenuModel[\s\S]*?onClearBuffer[\s\S]*?onCreate/u);
});

test('the tab menu keeps its separators after a null is filtered out', () => {
  /* `filter` drops the first item only when it is null, so a leading separator never renders. */
  const menu = load('terminalTabMenu');
  const items = menu(
    (key) => key,
    { cwd: '/w', title: 'zsh' },
    {
      rename: () => {},
      duplicate: () => {},
      close: () => {},
      closeOthers: () => {},
      splitRight: null,
      reopen: null,
      cycleColor: () => {},
    },
  );
  assert.equal(items[0].id, 'rename');
  assert.equal(
    items.some((item) => item.id === 'color'),
    true,
  );
  /* There must be no separator directly after another separator or at the end. */
  for (let index = 1; index < items.length; index += 1) {
    if (items[index] === null) assert.notEqual(items[index - 1], null);
  }
  if (items.length > 0) assert.notEqual(items[items.length - 1], null);
});
