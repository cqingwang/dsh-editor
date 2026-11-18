import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/context-menu.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  const signatureEnd = source.indexOf(')', start);
  let index = source.indexOf('{', signatureEnd);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

function loadHelper() {
  return new Function(
    `${extract('basename')}\n${extract('pathWithLine')}\n${extract('shellQuote')}\n${extract('copyReferenceMenuItems')}\nreturn copyReferenceMenuItems;`,
  )();
}

const translate = (key, values = {}) => {
  const short = key.replace(/^editor\./u, '');
  return values.count === undefined ? short : `${short}:${values.count}`;
};

test('Copy Path/Reference exposes IDEA actions in order', () => {
  const items = loadHelper()({
    entries: [{ path: 'docs/a b.txt' }],
    root: '/repo',
    t: translate,
    editor: { getPosition: () => ({ lineNumber: 7, column: 3 }) },
    editorPath: 'docs/a b.txt',
    writeText: () => {},
  });
  assert.deepEqual(
    items.map((item) => item === null ? null : item.id),
    ['copyPath', 'copyFileName', null, 'copyPosition', 'copyRelative', null, 'copyAbsolute'],
  );
});

test('single-file Copy Path/Reference keeps IDEAs semantics and DSH shell quoting', () => {
  const copied = [];
  const items = loadHelper()({
    entries: [{ path: 'docs/a b.txt' }],
    root: '/repo',
    t: translate,
    editor: { getPosition: () => ({ lineNumber: 7, column: 3 }) },
    editorPath: 'docs/a b.txt',
    writeText: (value) => copied.push(value),
  });
  const action = (id) => items.find((item) => item?.id === id);
  action('copyPath').run();
  action('copyFileName').run();
  action('copyPosition').run();
  action('copyRelative').run();
  action('copyAbsolute').run();
  assert.deepEqual(copied, [
    '/repo/docs/a b.txt',
    'a b.txt',
    'docs/a b.txt:7:3',
    'docs/a b.txt',
    "'/repo/docs/a b.txt'",
  ]);
});

test('multi-row Copy Path/Reference copies paths and names but disables positional forms', () => {
  const copied = [];
  const items = loadHelper()({
    entries: [{ path: 'docs/a b.txt' }, { path: 'README.md' }],
    root: '/repo',
    t: translate,
    editor: { getPosition: () => ({ lineNumber: 1, column: 1 }) },
    editorPath: 'README.md',
    writeText: (value) => copied.push(value),
  });
  const action = (id) => items.find((item) => item?.id === id);
  assert.equal(action('copyPath').label, 'copySelectedPaths:2');
  assert.equal(action('copyPosition').disabled, true);
  assert.equal(action('copyRelative').disabled, true);
  assert.equal(action('copyAbsolute').disabled, true);
  action('copyPath').run();
  action('copyFileName').run();
  assert.deepEqual(copied, [
    '/repo/docs/a b.txt\n/repo/README.md',
    'a b.txt\nREADME.md',
  ]);
});

test('Project and Changes reuse the same Copy Path/Reference implementation', () => {
  const treeMenu = source.slice(
    source.indexOf('const buildTreeMenu = React.useCallback('),
    source.indexOf('/* Move one entry into a directory by drag-and-drop'),
  );
  const changeMenu = source.slice(
    source.indexOf('const buildChangeMenu = React.useCallback('),
    source.indexOf('const buildChangeDirMenu = React.useCallback(', source.indexOf('const buildChangeMenu = React.useCallback(')),
  );
  assert.match(treeMenu, /id: 'copyReference'[\s\S]*?items: copyReferenceMenuItems\(\{/);
  assert.match(changeMenu, /id: 'copyReference'[\s\S]*?items: copyReferenceMenuItems\(\{/);
  assert.match(treeMenu, /editor: currentCodeEditor\(\)/);
  assert.match(changeMenu, /editor: currentCodeEditor\(\)/);
});

test('submenu children honour disabled state in both copy reference menus', () => {
  const start = source.indexOf('function ContextMenu({ menu, onClose, t })');
  assert.notEqual(start, -1);
  const end = source.indexOf('function groupDiffToolbarActions(', start);
  assert.notEqual(end, -1);
  const menu = source.slice(start, end);
  assert.match(menu, /style: \{ \.\.\.styles\.menuItem, \.\.\.\(child\.danger \? styles\.menuItemDanger : null\), \.\.\.\(child\.disabled \? styles\.menuItemDisabled : null\) \}/);
  assert.match(menu, /disabled: child\.disabled === true,/);
  assert.match(menu, /onClick: \(event\) => \{\s*event\.stopPropagation\(\);\s*if \(child\.disabled === true\) return;/);
});
