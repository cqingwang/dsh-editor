import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');
const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const scopeEditorSource = await readFile(
  new URL('../src/client/components/search/FindScopeEditor.tsx', import.meta.url),
  'utf8',
);

function extractFunction(name) {
  const plain = source.indexOf(`    function ${name}(`);
  const asynchronous = source.indexOf(`    async function ${name}(`);
  const start = plain >= 0 ? plain : asynchronous;
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('local custom Scopes normalize names, ids and bounded include/exclude patterns', () => {
  const normalize = new Function(
    `${extractFunction('normalizeFindScopePatterns')}; ${extractFunction('normalizeCustomFindScopes')}; return normalizeCustomFindScopes;`,
  )();
  const scopes = normalize([
    {
      id: 'src-scope',
      name: '  Sources  ',
      include: 'src/**\n*.ts\nsrc/**',
      excludePatterns: 'src/generated/**',
    },
    { id: 'src-scope', name: 'duplicate id' },
    { id: 'INVALID ID', name: '', includePatterns: ['x'.repeat(513), ' *.md '] },
  ]);
  assert.deepEqual(scopes[0], {
    id: 'src-scope',
    name: 'Sources',
    includePatterns: ['src/**', '*.ts'],
    excludePatterns: ['src/generated/**'],
    shared: false,
  });
  assert.equal(scopes.length, 2);
  assert.equal(scopes[1].name, 'Scope 3');
  assert.deepEqual(scopes[1].includePatterns, ['*.md']);
});

test('Find scope persistence accepts custom ids but rejects malformed presets', () => {
  const normalize = new Function(`${extractFunction('normalizeFindSearchScope')}; return normalizeFindSearchScope;`)();
  assert.equal(normalize({ mode: 'scope', preset: 'custom:sources-1' }).preset, 'custom:sources-1');
  assert.equal(normalize({ mode: 'scope', preset: 'custom:BAD ID' }).preset, 'projectFiles');
  assert.equal(normalize({ mode: 'scope', preset: 'custom:' }).preset, 'projectFiles');
});

test('custom Scope storage is per workspace and restores normalized entries', () => {
  const values = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  try {
    const helpers = new Function(
      `${extractFunction('normalizeFindScopePatterns')};` +
        `${extractFunction('normalizeCustomFindScopes')};` +
        `${extractFunction('customFindScopesStorageKey')};` +
        `${extractFunction('readCustomFindScopes')};` +
        `${extractFunction('writeCustomFindScopes')};` +
        'return { readCustomFindScopes, writeCustomFindScopes };',
    )();
    helpers.writeCustomFindScopes('/workspace/a', [
      {
        id: 'src',
        name: 'Sources',
        includePatterns: ['src/**'],
        excludePatterns: ['src/generated/**'],
      },
    ]);
    assert.deepEqual(helpers.readCustomFindScopes('/workspace/a'), [
      {
        id: 'src',
        name: 'Sources',
        includePatterns: ['src/**'],
        excludePatterns: ['src/generated/**'],
        shared: false,
      },
    ]);
    assert.deepEqual(helpers.readCustomFindScopes('/workspace/b'), []);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Scope include/exclude globs are shared by browser-side filtering', () => {
  const helper = new Function(
    `${extractFunction('normalizeFindScopePatterns')}; ${extractFunction('findScopeGlobMatches')}; ${extractFunction('findScopePatternsMatch')};` +
      'return { findScopeGlobMatches, findScopePatternsMatch };',
  )();
  assert.equal(helper.findScopeGlobMatches('src/a.ts', 'src/**'), true);
  assert.equal(helper.findScopeGlobMatches('src/a.ts', '*.ts'), true);
  assert.equal(helper.findScopeGlobMatches('src/a.ts', 'src'), true);
  assert.equal(helper.findScopeGlobMatches('docs/a.md', 'src/**'), false);
  assert.equal(helper.findScopePatternsMatch('src/a.ts', ['src/**'], []), true);
  assert.equal(helper.findScopePatternsMatch('src/generated/a.ts', ['src/**'], ['src/generated/**']), false);
  assert.equal(helper.findScopePatternsMatch('docs/a.md', [], []), true);
});

test('IDEA XML scope subset round-trips shared include and exclude patterns', () => {
  const helper = new Function(
    `${extractFunction('normalizeFindScopePatterns')};` +
      `${extractFunction('normalizeCustomFindScopes')};` +
      `${extractFunction('sharedFindScopeId')};` +
      `${extractFunction('decodeScopeXmlText')};` +
      `${extractFunction('encodeScopeXmlText')};` +
      `${extractFunction('ideaScopeTermToPattern')};` +
      `${extractFunction('parseIdeaScopeXml')};` +
      `${extractFunction('serializeIdeaScopeXml')};` +
      'return { parseIdeaScopeXml, serializeIdeaScopeXml };',
  )();
  const parsed = helper.parseIdeaScopeXml(
    '<component name="DependencyValidationManager">' +
      '<scope name="Sources &amp; Tests" pattern="file:src//*||file:tests//*&amp;&amp;!file:src/generated//*" />' +
      '</component>',
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'Sources & Tests');
  assert.deepEqual(parsed[0].includePatterns, ['src/**', 'tests/**']);
  assert.deepEqual(parsed[0].excludePatterns, ['src/generated/**']);
  assert.equal(parsed[0].shared, true);
  const serialized = helper.serializeIdeaScopeXml(parsed);
  assert.match(serialized, /file:src\/\*\*/u);
  assert.match(serialized, /!file:src\/generated\/\*\*/u);
  assert.deepEqual(helper.parseIdeaScopeXml(serialized), parsed);
});

test('Scope XML transfer paths stay inside the workspace and report skipped scopes', () => {
  const helper = new Function(
    `${extractFunction('normalizeFindScopePatterns')};` +
      `${extractFunction('normalizeCustomFindScopes')};` +
      `${extractFunction('sharedFindScopeId')};` +
      `${extractFunction('decodeScopeXmlText')};` +
      `${extractFunction('encodeScopeXmlText')};` +
      `${extractFunction('ideaScopeTermToPattern')};` +
      `${extractFunction('parseIdeaScopeXml')};` +
      `${extractFunction('normalizeScopeXmlTransferPath')};` +
      `${extractFunction('inspectIdeaScopeXml')};` +
      'return { normalizeScopeXmlTransferPath, inspectIdeaScopeXml };',
  )();
  assert.equal(helper.normalizeScopeXmlTransferPath('.idea/scopes/dsh-editor.xml'), '.idea/scopes/dsh-editor.xml');
  assert.equal(helper.normalizeScopeXmlTransferPath('./.idea/scopes/a.xml'), '.idea/scopes/a.xml');
  assert.equal(helper.normalizeScopeXmlTransferPath('/absolute/a.xml'), '');
  assert.equal(helper.normalizeScopeXmlTransferPath('../a.xml'), '');
  assert.equal(helper.normalizeScopeXmlTransferPath('scope.txt'), '');
  const report = helper.inspectIdeaScopeXml(
    '<component name="DependencyValidationManager">' +
      '<scope name="Supported" pattern="file:src//*" />' +
      '<scope name="Language" pattern="src:foo..*" />' +
      '</component>',
  );
  assert.equal(report.total, 2);
  assert.equal(report.scopes.length, 1);
  assert.equal(report.skipped, 1);
});

test('host search and replacement enforce custom Scope patterns before writing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round696-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src/generated'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  const searchPath = join(root, 'src/a.ts');
  const generatedPath = join(root, 'src/generated/b.ts');
  const docsPath = join(root, 'docs/c.ts');
  await writeFile(searchPath, 'needle\n', 'utf8');
  await writeFile(generatedPath, 'needle\n', 'utf8');
  await writeFile(docsPath, 'needle\n', 'utf8');

  const found = await host.searchWorkspaceText(root, 'needle', {
    maxMatches: 20,
    scopeIncludePatterns: ['src/**'],
    scopeExcludePatterns: ['src/generated/**'],
  });
  assert.deepEqual(
    found.matches.map((match) => match.path),
    ['src/a.ts'],
  );

  const outsideInfo = await stat(docsPath);
  await assert.rejects(
    () =>
      host.replaceWorkspaceText(root, 'needle', 'omega', [{ path: 'docs/c.ts', mtime: outsideInfo.mtimeMs }], {
        scopeIncludePatterns: ['src/**'],
        scopeExcludePatterns: ['src/generated/**'],
      }),
    /outside custom scope/u,
  );
  assert.equal(await readFile(docsPath, 'utf8'), 'needle\n');
});

test('Edit Scopes dialog edits local names, include and exclude patterns', () => {
  const editor = scopeEditorSource;
  assert.match(editor, /data-dsh-find-scope-editor=''/);
  assert.match(editor, /role='dialog'/);
  assert.match(editor, /findAddScope/);
  assert.match(editor, /findDeleteScope/);
  assert.match(editor, /findScopeInclude/);
  assert.match(editor, /findScopeExclude/);
  assert.match(editor, /findScopeShare/);
  assert.match(editor, /findScopeImport/);
  assert.match(editor, /findScopeExport/);
  assert.match(editor, /data-dsh-find-scope-transfer/);
  assert.match(editor, /inspectIdeaScopeXml\(value\.content\)/);
  assert.match(editor, /callFs\(\{ op: 'write', path, content: transfer\.xml, force: true, create: true \}\)/);
  assert.match(editor, /normalizeCustomFindScopes\(drafts\)/);
  assert.match(editor, /onSave\(normalized, selectedId\)/);
  const findTool = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(findTool, /setScopeEditorOpen\(true\)/);
  assert.match(findTool, /`custom:\$\{savedId\}`/);
  assert.match(findTool, /customScopes\) \? customScopes : \[\]\)\.map/);
});

test('Find search and replace requests forward custom Scope patterns', () => {
  assert.match(source, /const findToolCustomScope = findToolSearchScopeMode === 'scope'/);
  assert.match(source, /scopeIncludePatterns: findToolScopeIncludePatterns/);
  assert.match(source, /scopeExcludePatterns: findToolScopeExcludePatterns/);
  assert.equal((source.match(/scopeIncludePatterns: findToolScopeIncludePatterns/gu) ?? []).length, 3);
  assert.match(source, /customScope: findToolCustomScope/);
  assert.match(source, /customScopes: customFindScopes/);
  assert.match(source, /onCustomScopesChange: changeCustomFindScopes/);
  assert.match(source, /dsh-editor\.find\.customScopes\.v1:/);
  assert.match(source, /\.idea\/scopes\/dsh-editor\.xml/);
  assert.match(source, /serializeIdeaScopeXml\(sharedScopes\)/);
  assert.match(source, /parseIdeaScopeXml\(value\?\.content\)/);
});
