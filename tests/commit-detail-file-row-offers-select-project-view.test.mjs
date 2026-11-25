import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/components/commit/CommitLogDetailPane.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/components/commit/file-menu.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'lib/client.js'), 'utf8'),
].join('\n');
const projectSelectionModelSource = readFileSync(
  join(root, 'src/client/components/project/project-selection-model.ts'),
  'utf8',
);

/** The body of one `function name(...) {...}` (brace-balanced, template-safe enough here). */
function bodyOf(marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${marker} is missing`);
  /* The first `{` belongs to the destructured parameter list, not the body: skip
     the whole parameter list so the braces actually balance the function. */
  const paramsEnd = source.indexOf('}) {', start);
  let index = paramsEnd < 0 ? source.indexOf('{', start) : paramsEnd + 3;
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces in ${marker}`);
}

test('the commit detail file row offers Select in Project View', () => {
  const body = bodyOf('function CommitLogDetailPane({');
  /* The menu is opened from the row, not from the whole detail pane. */
  assert.match(
    body,
    /onContextMenu=\{\(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+event\.currentTarget\.focus\?\.\(\);\s+onFileMenu\?\.\(\{\s+path: file\.path,\s+hash: detail\.hash,\s+localExists,\s+localDirExists,\s+x: event\.clientX,\s+y: event\.clientY,\s+\}\);/s,
  );
  /* The callback's body starts after its indented parameter list. */
  const menu = source;
  assert.match(menu, /t\('editor\.revealInProject'\)/);
  assert.match(menu, /run: \(\) => onRevealPath\(path\)/);
  assert.match(menu, /t\('editor\.showHistory'\)/);
});

test('reveal expands the ancestors instead of only moving the selection', () => {
  /* Round 138 split the "select and scroll" half into `revealInProjectTree`, so
     "Autoscroll from Source" can follow the active tab WITHOUT also switching the
     tool window back to Project. The expansion work moved with it. */
  const tree = bodyOf('const revealInProjectTree = React.useCallback(');
  assert.match(tree, /setExpanded\(nextExpanded\);/);
  assert.match(tree, /revealProjectRow\(path\)/);
  assert.match(projectSelectionModelSource, /function revealProjectRowElement\(/);
  assert.match(projectSelectionModelSource, /row\?\.scrollIntoView\(\{ block: 'center' \}\)/);
  assert.match(
    projectSelectionModelSource,
    /document\.querySelector<HTMLElement>\('\[data-dsh-project-tree\]'\)\?\.focus/,
  );
  /* Ancestors are loaded on demand, so a collapsed directory still opens. */
  assert.match(tree, /op: 'list',\s+path: prefix,/);
  /* The explicit "Select in Project View" still reveals the tool window itself. */
  const body = bodyOf('const revealPath = React.useCallback(');
  assert.match(body, /setActivity\('project'\);/);
  assert.match(body, /setPanelVisible\(true\);/);
  assert.match(body, /await revealInProjectTree\(path\)/);
});

test('closing the right split hands focus back to the surviving pane', () => {
  assert.match(source, /if \(splitId === null && focusedPane === 'right'\) setFocusedPane\('left'\);/);
});
