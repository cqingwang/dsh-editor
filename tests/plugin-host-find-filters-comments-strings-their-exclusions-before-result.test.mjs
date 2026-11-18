import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { loadTypeScriptFunction, loadTypeScriptModule } from './ts-source.mjs';

const host = await import('../lib/index.js');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const findToolWindowSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source = [workspaceSource, findToolWindowSource, terminalSource, commitSource].join('\n');

function clientTextContextHelpers() {
  return loadTypeScriptModule(terminalSource, ['editorFindResult', 'editorReplaceAt', 'editorReplaceAll']);
}

const CONTEXT_FIXTURE = [
  'const a = "needle";',
  '// needle comment',
  "const b = 'needle';",
  '/* needle block */',
  'const c = needle;',
  '',
].join('\n');

test('host Find filters comments, strings and their exclusions before the result cap', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round695-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.ts'), CONTEXT_FIXTURE, 'utf8');

  const lines = async (contextFilter) => {
    const result = await host.searchWorkspaceText(root, 'needle', { maxMatches: 20, contextFilter });
    return result.matches.map((match) => match.line);
  };
  assert.deepEqual(await lines('anywhere'), [1, 2, 3, 4, 5]);
  assert.deepEqual(await lines('comments'), [2, 4]);
  assert.deepEqual(await lines('strings'), [1, 3]);
  assert.deepEqual(await lines('exceptComments'), [1, 3, 5]);
  assert.deepEqual(await lines('exceptStrings'), [2, 4, 5]);
  assert.deepEqual(await lines('exceptBoth'), [5]);
});

test('host Replace All and exact replacement obey the same lexical filter', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round695-replace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.ts');
  await writeFile(path, CONTEXT_FIXTURE, 'utf8');

  const before = await stat(path);
  const comments = await host.replaceWorkspaceText(root, 'needle', 'omega', [{ path: 'a.ts', mtime: before.mtimeMs }], {
    contextFilter: 'comments',
  });
  assert.equal(comments.replacements, 2);
  assert.equal(
    await readFile(path, 'utf8'),
    'const a = "needle";\n// omega comment\nconst b = \'needle\';\n/* omega block */\nconst c = needle;\n',
  );

  const current = await stat(path);
  await assert.rejects(
    () =>
      host.replaceWorkspaceText(root, 'needle', 'bad', [{ path: 'a.ts', mtime: current.mtimeMs }], {
        contextFilter: 'comments',
        occurrence: { line: 1, column: 11 },
      }),
    /search result no longer matches/u,
  );
});

test('lexical filtering composes with Regex search and capture replacement', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round695-regex-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.ts');
  await writeFile(path, 'const a = "foo-1";\n// foo-2\nconst b = foo-3;\n', 'utf8');

  const search = await host.searchWorkspaceText(root, 'foo-(\\d+)', {
    maxMatches: 20,
    regex: true,
    contextFilter: 'comments',
  });
  assert.deepEqual(
    search.matches.map((match) => [match.line, match.column]),
    [[2, 4]],
  );

  const info = await stat(path);
  const replaced = await host.replaceWorkspaceText(
    root,
    'foo-(\\d+)',
    'id-$1',
    [{ path: 'a.ts', mtime: info.mtimeMs }],
    { regex: true, contextFilter: 'comments' },
  );
  assert.equal(replaced.replacements, 1);
  assert.equal(await readFile(path, 'utf8'), 'const a = "foo-1";\n// id-2\nconst b = foo-3;\n');
});

test('dirty Monaco buffers use the same lexical search and Replace All rules', () => {
  const helpers = clientTextContextHelpers();
  const matches = (contextFilter) =>
    helpers
      .editorFindResult(CONTEXT_FIXTURE, 'needle', {
        path: 'a.ts',
        contextFilter,
      })
      .matches.map((match) => match.offset);
  assert.deepEqual(matches('comments'), [23, 61]);
  assert.deepEqual(matches('strings'), [11, 49]);
  assert.deepEqual(matches('exceptBoth'), [87]);

  const comments = helpers.editorReplaceAll(CONTEXT_FIXTURE, 'needle', 'omega', {
    path: 'a.ts',
    contextFilter: 'comments',
  });
  assert.equal(comments.count, 2);
  assert.match(comments.text, /\/\/ omega comment/u);
  assert.match(comments.text, /const a = "needle";/u);

  const blocked = helpers.editorReplaceAt(CONTEXT_FIXTURE, 'needle', 'omega', 11, {
    path: 'a.ts',
    contextFilter: 'comments',
  });
  assert.match(blocked.error, /no longer matches/u);
});

test('Filter Search Results exposes all six IDEA modes and reruns Find on selection', () => {
  const findTool = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(findTool, /onContextFilterChange/);
  for (const id of ['anywhere', 'comments', 'strings', 'exceptComments', 'exceptStrings', 'exceptBoth']) {
    assert.match(findTool, new RegExp(`id: '${id}'[\\s\\S]*?run: \\(\\) => select\\('${id}'\\)`));
  }
  assert.match(findTool, /contextFilter === 'comments' \? '✓' : ''/);
  assert.doesNotMatch(findTool, /id: 'comments'[\s\S]{0,120}disabled: true/);
  assert.match(workspaceSource, /onContextFilterChange=\{\(contextFilter\) =>\s*setFindTool\(/);
  assert.match(source, /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1/);
});

test('Find search, dirty merge and both replace paths forward contextFilter', () => {
  assert.match(workspaceSource, /contextFilter: normalizeTextSearchContextFilter\(findTool\?\.contextFilter\)/);
  assert.equal(
    (workspaceSource.match(/contextFilter: normalizeTextSearchContextFilter\(findTool\.contextFilter\)/gu) ?? [])
      .length >= 4,
    true,
  );
  const normalize = loadTypeScriptFunction(commitSource, 'normalizeSearchOptions');
  assert.equal(normalize({ contextFilter: 'comments' }).contextFilter, 'comments');
  assert.equal('contextFilter' in normalize(null), false);
});
