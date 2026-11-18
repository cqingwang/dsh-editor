import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const describeMoved = new Function(
  `${transpileTypeScriptFunction(terminalSource, 'describeMoved')}\nreturn describeMoved;`,
)();

/**
 * A stand-in for the plugin translator: both dictionaries must supply both keys,
 * so a missing key here fails loudly instead of rendering a raw key.
 */
const dictionaries = {
  'editor.moveConflict': { zh: '{path} 已存在，未移动', en: '{path} already exists; nothing was moved' },
  'editor.movePartial': { zh: '已移动 {moved}；{path} 已存在，未移动', en: 'Moved {moved}; {path} already exists and was left alone' },
};
function translator(language) {
  return (key, params = {}) => {
    let text = dictionaries[key]?.[language] ?? `MISSING:${key}`;
    for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
    return text;
  };
}

test('a partial batch move says what did move before the refusal', () => {
  /* The drag moved one file and refused another: saying only "already exists"
     leaves the user thinking nothing happened. */
  const text = describeMoved(['lib/a.txt'], 'lib/b.txt', translator('zh'));
  assert.match(text, /lib\/a\.txt/);
  assert.match(text, /lib\/b\.txt/);
  assert.match(text, /已移动/);
});

test('a fully refused move only names the conflict', () => {
  const text = describeMoved([], 'lib/b.txt', translator('zh'));
  assert.match(text, /lib\/b\.txt/);
  assert.doesNotMatch(text, /已移动/);
  /* English reads the same way, from the same translator. */
  const english = describeMoved([], 'lib/b.txt', translator('en'));
  assert.doesNotMatch(english, /^Moved /u);
  assert.match(english, /already exists/u);
});

test('the tree notice is built from the plan, after the refresh', () => {
  const start = source.indexOf('const moveEntry =');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('/* Resolve one conflicted file', start));
  /* Round 113 routes the summary through `describeMoveResult` first, so a clean
     move can be acknowledged as well as a partial one. */
  assert.match(block, /const summary = describeMoveResult\(\{[\s\S]*?moved: entries\.map/);
  assert.match(
    block,
    /describeMoved\(\s+entries\.map\(\(\[, to\]\) => to\),\s+summary\.blocked,\s+t,\s+\);/u,
  );
  /* The wording must come from the plugin translator, not `navigator.language`:
     a zh UI on an en-US browser rendered English there. */
  assert.doesNotMatch(block, /navigator\.language/);
  assert.match(block, /const moveNotice =\s+summary === null/u);
  /* The notice has to land after `refreshTree`, which clears `treeError`. */
  const refreshAt = block.indexOf('await refreshTree();');
  const noticeAt = block.indexOf('setTreeError(moveNotice);');
  assert.ok(refreshAt >= 0 && noticeAt > refreshAt, 'the notice must follow the refresh');
});
