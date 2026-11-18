import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
);

test('Find groups can be ordered by directory or file without dropping matches', () => {
  const helpers = new Function(
    `${extractFunction('dirname')};
     ${extractFunction('normalizeFindGroupBy')};
     ${extractFunction('orderFindToolGroups')};
     ${extractFunction('findToolDisplayGroups')};
     return { normalizeFindGroupBy, orderFindToolGroups, findToolDisplayGroups };`,
  )();
  const groups = [
    { path: 'src/z.ts', matches: [{ path: 'src/z.ts' }] },
    { path: 'docs/a.md', matches: [{ path: 'docs/a.md' }, { path: 'docs/a.md' }] },
    { path: 'src/a.ts', matches: [{ path: 'src/a.ts' }] },
  ];
  assert.equal(helpers.normalizeFindGroupBy('directory'), 'directory');
  assert.equal(helpers.normalizeFindGroupBy('file'), 'file');
  assert.equal(helpers.normalizeFindGroupBy('junk'), 'file');
  assert.deepEqual(
    helpers.orderFindToolGroups(groups, 'file').map((group) => group.path),
    ['src/z.ts', 'docs/a.md', 'src/a.ts'],
  );
  assert.deepEqual(
    helpers.orderFindToolGroups(groups, 'directory').map((group) => group.path),
    ['docs/a.md', 'src/a.ts', 'src/z.ts'],
  );
  const display = helpers.findToolDisplayGroups(groups, 'directory');
  assert.deepEqual(display.map((entry) => entry.kind), ['directory', 'file', 'directory', 'file', 'file']);
  assert.equal(display[0].path, 'docs');
  assert.equal(display[0].count, 2);
  assert.equal(display[2].path, 'src');
  assert.equal(display[2].count, 2);
});

test('Persistent Find exposes truthful Group By choices', () => {
  assert.match(findTool, /const \[findGroupBy, setFindGroupBy\] = React\.useState\(\(\) => normalizeFindGroupBy\(readStoredText\('dsh-editor\.find\.groupBy', 'file'\)\)\)/);
  assert.match(findTool, /id: 'groupBy'/);
  assert.match(findTool, /label: t\('editor\.findGroupByDirectory'\),[\s\S]*?shortcut: '⌃D'/);
  assert.match(findTool, /label: t\('editor\.findGroupByFile'\),[\s\S]*?shortcut: '⌃S'/);
  assert.match(findTool, /label: t\('editor\.findGroupByModule'\),[\s\S]*?disabled: true/);
  assert.match(findTool, /label: t\('editor\.findGroupByPackage'\),[\s\S]*?disabled: true/);
  assert.match(findTool, /localStorage\.setItem\('dsh-editor\.find\.groupBy', next\)/);
});

test('Group By keyboard shortcuts stay out of text inputs', () => {
  const rootKeydown = findTool.slice(
    findTool.indexOf("'data-dsh-find-tool-window': ''"),
    findTool.indexOf('React.createElement(\n          \'div\',\n          { style: styles.findToolToolbar }'),
  );
  assert.match(rootKeydown, /event\.ctrlKey === true/);
  assert.match(rootKeydown, /if \(key === 'd' \|\| key === 's'\)/);
  assert.match(rootKeydown, /closest\('input, textarea, select, \[role="menu"\]'\)/);
  assert.match(rootKeydown, /selectFindGroupBy\(key === 'd' \? 'directory' : 'file'\)/);
});

test('Directory grouping renders real directory headers before file groups', () => {
  assert.match(findTool, /const displayGroups = findToolDisplayGroups\(groups, findGroupBy\)/);
  assert.match(findTool, /'data-dsh-find-directory': group\.path/);
  assert.match(findTool, /t\('editor\.findDirectoryRoot'\)/);
  assert.match(findTool, /styles\.findToolDirectoryRow/);
});

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}
