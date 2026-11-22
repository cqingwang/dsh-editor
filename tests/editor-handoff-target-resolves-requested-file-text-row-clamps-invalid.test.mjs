import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('(', start);
  let parenDepth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '(') parenDepth += 1;
    else if (source[index] === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) break;
    }
  }
  index = source.indexOf('{', index);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function targetFactory() {
  return new Function(
    `${extractSource('dirname')}\n${extractSource('groupFindMatches')}\n${extractSource('normalizeFindGroupBy')}\n${extractSource('orderFindToolGroups')}\n${extractSource('findToolVisibleRows')}\n${extractSource('findToolHandoffTarget')}\nreturn findToolHandoffTarget;`,
  )();
}

test('handoff target resolves the requested file or text row and clamps invalid indexes', () => {
  const resolveTarget = targetFactory();
  const files = [{ path: 'src/app.js', rowKey: 'file:src/app.js' }];
  const matches = [
    { path: 'README.md', line: 3, column: 1 },
    { path: 'docs/notes.md', line: 2, column: 1 },
  ];
  assert.deepEqual(resolveTarget(files, matches, 0), {
    kind: 'file',
    path: 'src/app.js',
    rowKey: 'file:src/app.js',
    index: 0,
  });
  assert.deepEqual(resolveTarget(files, matches, 2), {
    kind: 'text',
    path: 'docs/notes.md',
    rowKey: 'text:docs/notes.md:2:1',
    index: 2,
  });
  assert.equal(resolveTarget(files, matches, -20)?.rowKey, 'file:src/app.js');
  assert.equal(resolveTarget(files, matches, 200)?.rowKey, 'text:docs/notes.md:2:1');
  assert.equal(resolveTarget([], [], 5), null);
});

test('each Find handoff gets a monotonic revision', () => {
  assert.match(source, /const findToolHandoffSequenceRef = React\.useRef\(0\)/);
  const opener = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('React.useEffect(() => {\n        if (searchEverywhere !== null) writeSearchOptions'),
  );
  assert.match(opener, /handoffRevision: \+\+findToolHandoffSequenceRef\.current/);
});

test('Find expands a collapsed target group before converging the active index', () => {
  const component = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(component, /const handoffRevision = Math\.max\(0, Number\(state\.handoffRevision\) \|\| 0\)/);
  assert.match(
    component,
    /const handoffHandledRevision = Math\.max\(0, Number\(state\.handoffHandledRevision\) \|\| 0\)/,
  );
  assert.match(
    component,
    /const handoffTarget = React\.useMemo\(\s+\(\) => findToolHandoffTarget\(scopedFileResults, scopedMatches, state\.index, findGroupBy\),/u,
  );
  assert.match(component, /onHandoffHandled\?\.\(handoffRevision\)/);
  assert.match(component, /setCollapsedFiles\(\(current\) => \{[\s\S]*next\.delete\(handoffTarget\.path\)/);
  assert.match(component, /if \(handoffRevision <= handoffHandledRevision\) return;/);
  assert.match(component, /findToolReconciledResultRow\(occurrences, state\.index, state\.activeRowKey\)/);
  assert.match(component, /onMove\(0, occurrences\.length, reconciled\.index, reconciled\.rowKey \?\? undefined\)/);
});

test('replace mode keeps the same handoff and result state', () => {
  const replaceMode = source.slice(
    source.indexOf('onReplaceMode: () => setFindTool'),
    source.indexOf('onReplaceOccurrence:'),
  );
  assert.match(replaceMode, /\.\.\.current, mode: 'replace'/);
  assert.doesNotMatch(replaceMode, /handoffRevision|files:|matches:|index:/);
});
