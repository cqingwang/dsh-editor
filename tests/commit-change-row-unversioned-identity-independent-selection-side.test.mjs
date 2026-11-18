import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated function ${name}`);
}

test('a change row keeps its unversioned identity independent of selection side', () => {
  const group = extractFunction('changeRowGroup');
  assert.equal(group({ status: '??' }, false), 'unversioned');
  assert.equal(group({ status: '??' }, true), 'unversioned');
  assert.equal(group({ status: 'M ' }, true), 'staged');
  assert.equal(group({ status: ' M' }, false), 'unstaged');
  assert.equal(group({ status: 'MM' }, false), 'unstaged');
});

test('changing Group by reveals and focuses the current Change row', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const block = workspace.slice(
    workspace.indexOf('const applyChangeGroupBy = React.useCallback('),
    workspace.indexOf('const changeGroupMenu = React.useCallback(', workspace.indexOf('const applyChangeGroupBy = React.useCallback(')),
  );
  assert.notEqual(block.length, 0);
  assert.match(block, /selectedChangeRef\.current/);
  assert.match(block, /groupByFocusRef\.current = \{ path: selected\.path, staged: selected\.staged === true \}/);
  assert.match(block, /revealChangeRow\(selected\);/);
  const focusEffect = workspace.slice(
    workspace.indexOf('const groupByFocusRef = React.useRef(null);'),
    workspace.indexOf('/* The change-list filter;', workspace.indexOf('const groupByFocusRef = React.useRef(null);')),
  );
  assert.match(focusEffect, /changeRowRefs\.current\.get\(key\)/);
  assert.match(focusEffect, /row\.focus\?\.\(\)/);
  assert.match(focusEffect, /scrollIntoView\?\.\(\{ block: 'nearest' \}\)/);
});

test('Group by items call the reveal-aware apply path', () => {
  const block = source.slice(
    source.indexOf('const changeGroupMenu = React.useCallback('),
    source.indexOf('const openChangesViewMenu = React.useCallback('),
  );
  assert.match(block, /run: \(\) => applyChangeGroupBy\(mode\)/);
  assert.match(block, /restoreFocus: false/);
  assert.match(block, /\[applyChangeGroupBy, groupBy, t\]/);
});
