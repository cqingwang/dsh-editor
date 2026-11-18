import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');
const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round714-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scope', 'nested'), { recursive: true });
  await writeFile(join(root, 'scope', 'top.txt'), 'R714_REPLACE_TOKEN top\n', 'utf8');
  await writeFile(join(root, 'scope', 'nested', 'deep.txt'), 'R714_REPLACE_TOKEN deep\n', 'utf8');
  return root;
}

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

test('non-recursive Directory search targets replace only direct files', async (t) => {
  const root = await fixture(t);
  const search = await host.searchWorkspaceText(root, 'R714_REPLACE_TOKEN', {
    directory: 'scope',
    recursive: false,
  });
  assert.deepEqual([...new Set(search.matches.map((match) => match.path))], ['scope/top.txt']);
  const targets = search.matches.map((match) => ({ path: match.path, mtime: match.mtime }));
  const replaced = await host.replaceWorkspaceText(root, 'R714_REPLACE_TOKEN', 'R714_REPLACE_DONE', targets, {});
  assert.deepEqual(replaced.files, ['scope/top.txt']);
  assert.equal(await readFile(join(root, 'scope', 'top.txt'), 'utf8'), 'R714_REPLACE_DONE top\n');
  assert.equal(
    await readFile(join(root, 'scope', 'nested', 'deep.txt'), 'utf8'),
    'R714_REPLACE_TOKEN deep\n',
  );
});

test('dirty merge uses the same direct-child Directory predicate', () => {
  const matchesScope = new Function(
    `${extractFunction('findToolPathMatchesScope')}; return findToolPathMatchesScope;`,
  )();
  const recursive = { directory: 'scope', recursive: true };
  const direct = { directory: 'scope', recursive: false };
  assert.equal(matchesScope('scope/top.txt', 'directory', recursive), true);
  assert.equal(matchesScope('scope/nested/deep.txt', 'directory', recursive), true);
  assert.equal(matchesScope('scope/top.txt', 'directory', direct), true);
  assert.equal(matchesScope('scope/nested/deep.txt', 'directory', direct), false);
});

test('Find dirty merge and Replace All share the scoped row set', () => {
  assert.match(source, /recursive: findTool\?\.searchScopeRecursive !== false/u);
  assert.match(source, /const scopedReplacementPaths = new Set\(scopedMatches\.map\(\(match\) => match\.path\)\)/u);
  assert.match(source, /if \(scopedMatches\.length > 0\) onReplaceAll\(scopedReplacementPaths\)/u);
});

test('Scope invalidation keeps the old rows visible until the next generation replaces them', () => {
  const changeScope = source.slice(
    source.indexOf('const changeFindToolScope = React.useCallback'),
    source.indexOf('/** Persist and reapply IDEA\'s Directory recursion toggle. */'),
  );
  const changeRecursive = source.slice(
    source.indexOf('const changeFindDirectoryRecursive = React.useCallback'),
    source.indexOf('/** Persist local named Scopes and invalidate a selection that disappeared. */'),
  );
  for (const block of [changeScope, changeRecursive]) {
    assert.match(block, /const hasQuery = hasFindToolContentQuery\(current\.query\)/u);
    assert.match(block, /loading: hasQuery/u);
    assert.match(block, /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1/u);
    assert.match(block, /loadedGeneration: -1/u);
  }
  assert.match(changeScope, /files: current\.files,\s+matches: current\.matches,\s+index: current\.index,/u);
  assert.match(
    source,
    /const retainPreviousResultsWhileLoading =\s+\(state\.loading === true && state\.loadedGeneration !== state\.searchGeneration\) \|\| state\.error !== null;/u,
  );
  assert.match(
    source,
    /if \(!previewOpen \|\| active === null \|\| typeof active\.path !== 'string' \|\| active\.path === ''\) \{[\s\S]*?setPreviewState\(\{\s+loading: false,\s+path: '',\s+content: '',\s+line: 1,\s+error: null,\s+\}\);/u,
  );
});
