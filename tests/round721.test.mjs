import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

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

function expandedStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  const windowStub = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  };
  const helpers = new Function(
    'window',
    `${extractFunction('expandedStorageKey')};`
      + `${extractFunction('readExpanded')};`
      + `${extractFunction('writeExpanded')};`
      + 'return { expandedStorageKey, readExpanded, writeExpanded };',
  )(windowStub);
  return { helpers, values };
}

test('legacy auto-expanded state cannot reopen Project descendants', () => {
  const root = '/repo';
  const legacyKey = `dsh-editor.expanded:${root}`;
  const { helpers } = expandedStore({
    [legacyKey]: JSON.stringify(['src', 'src/lang', 'src/lang/base']),
  });
  assert.deepEqual(helpers.readExpanded(root), []);
  assert.notEqual(helpers.expandedStorageKey(root), legacyKey);
});

test('manual expansion state is stored and restored through the v2 key', () => {
  const root = '/repo';
  const { helpers, values } = expandedStore();
  const key = helpers.expandedStorageKey(root);
  assert.match(key, /^dsh-editor\.expanded\.v2:/);
  helpers.writeExpanded(root, new Set(['', 'src', 'src/lang']));
  assert.equal(values.get(key), JSON.stringify(['src', 'src/lang']));
  assert.deepEqual(helpers.readExpanded(root), ['src', 'src/lang']);
});

test('startup prefetch fills cache without expanding cached directories', () => {
  const root = source.slice(
    source.indexOf('const loadRoot = React.useCallback'),
    source.indexOf('React.useEffect(() => {\n        void loadRoot();'),
  );
  assert.match(root, /prefetchDirectorySubtrees\(/);
  assert.doesNotMatch(root, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.Object\.keys\(prefetched\.children\)\]\)\)/);
  assert.doesNotMatch(root, /writeExpanded\([^\n]*prefetched/);
  assert.match(source, /const \[expanded, setExpanded\] = React\.useState\(\(\) => new Set\(\[''\]\)\)/);
});

test('the first restored active tab does not expand Project ancestors', () => {
  assert.match(
    source,
    /Initial tab restoration can walk through several active paths[\s\S]*?if \(sessionRestoringRef\.current\) return;/,
  );
  assert.match(source, /if \(!projectAutoScrollArmedRef\.current\) return;/);
  assert.match(source, /projectAutoScrollArmedRef\.current = false/);
  assert.match(source, /projectAutoScrollArmedRef\.current = true/);
  assert.match(source, /void revealInProjectTree\(activePath\)/);
});
