import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

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

const groups = [
  { id: 'staged', changes: [{ path: 'src/a.ts' }, { path: 'src/b.ts' }] },
  { id: 'unstaged', changes: [{ path: 'src/c.ts' }] },
  { id: 'unversioned', changes: [{ path: 'new.txt' }] },
];

test('filtered change targets preserve the staged identity of each visible row', () => {
  const targets = extractFunction('changeFilterTargets');
  assert.deepEqual(targets(groups), [
    { path: 'src/a.ts', staged: true },
    { path: 'src/b.ts', staged: true },
    { path: 'src/c.ts', staged: false },
    { path: 'new.txt', staged: false },
  ]);
  assert.deepEqual(targets([]), []);
});

test('change-filter arrows stay inside the visible target set and cycle', () => {
  const targets = extractFunction('changeFilterTargets')(groups);
  const next = extractFunction('cycleChangeTarget');
  assert.deepEqual(next(targets, null, 'next'), { path: 'src/a.ts', staged: true });
  assert.deepEqual(next(targets, null, 'previous'), { path: 'src/a.ts', staged: true });
  assert.deepEqual(next(targets, { path: 'src/a.ts', staged: true }, 'next'), { path: 'src/b.ts', staged: true });
  assert.deepEqual(next(targets, { path: 'new.txt', staged: false }, 'next'), { path: 'src/a.ts', staged: true });
  assert.deepEqual(next(targets, { path: 'src/a.ts', staged: true }, 'previous'), { path: 'new.txt', staged: false });
  assert.equal(next(targets, null, 'next') === null, false);
  assert.equal(next([], { path: 'src/a.ts', staged: true }, 'next'), null);
});

test('the Changes filter selects a visible row and keeps arrow navigation in the box', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  assert.match(panel, /const filteredTargets = React\.useMemo\(\s*\(\) => changeFilterTargets\(visibleGroups\)/);
  assert.match(panel, /const target = cycleChangeTarget\(filteredTargets, selectedChange, direction\)/);
  assert.match(panel, /event\.key === 'ArrowDown'/);
  assert.match(panel, /event\.key === 'ArrowUp'/);
  assert.match(panel, /onSelectChange\?\.\(\{ path: target\.path, staged: target\.staged \}\)/);
});

test('changing the path filter cannot leave the action target on a hidden row', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const effect = panel.slice(
    panel.indexOf('React.useEffect(() => {', panel.indexOf('const filteredTargets')),
    panel.indexOf('const renderGroup =', panel.indexOf('const filteredTargets')),
  );
  assert.match(effect, /pathQuery\.trim\(\) === ''/);
  assert.match(effect, /filteredTargets\.some/);
  assert.match(effect, /onSelectChange\?\.\(\{ path: filteredTargets\[0\]\.path, staged: filteredTargets\[0\]\.staged \}\)/);
});
